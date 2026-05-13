using System.Data;
using Dapper;
using Microsoft.Extensions.Logging;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Log;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Log;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Infrastructure.Search;
using SHTL.Modules.Shared.Contracts;

namespace SHTL.Modules.Core.Application.Services;

public interface IFolderDocumentsPurgeService
{
    /// <summary>
    /// Xóa toàn bộ tài liệu đang hoạt động trong “thư mục ảo” (khớp báo cáo tiến độ):
    /// xóa dòng con trong DB, soft-delete <c>stg_documents</c>, đổi tên file storage (_deleteat), gỡ index ES (best-effort).
    /// </summary>
    Task<FolderPurgeResult> PurgeVirtualFolderAsync(string virtualFolderName, ICurrentUser user, CancellationToken cancellationToken = default);
}

public sealed record FolderPurgeResult(bool Success, string Message, int DocumentsAffected, IReadOnlyList<string>? Warnings = null);

public sealed class FolderDocumentsPurgeService : IFolderDocumentsPurgeService
{
    private const int StorageParallelism = 16;
    private const int SearchParallelism = 8;

    private readonly AppDbContext _db;
    private readonly IDocumentRepository _documents;
    private readonly IStorageService _storage;
    private readonly IDocumentSearchService _search;
    private readonly IActionLogRepository _actionLog;
    private readonly ILogger<FolderDocumentsPurgeService> _logger;

    public FolderDocumentsPurgeService(
        AppDbContext db,
        IDocumentRepository documents,
        IStorageService storage,
        IDocumentSearchService search,
        IActionLogRepository actionLog,
        ILogger<FolderDocumentsPurgeService> logger)
    {
        _db = db;
        _documents = documents;
        _storage = storage;
        _search = search;
        _actionLog = actionLog;
        _logger = logger;
    }

    public async Task<FolderPurgeResult> PurgeVirtualFolderAsync(string virtualFolderName, ICurrentUser user, CancellationToken cancellationToken = default)
    {
        var folder = (virtualFolderName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(folder))
            return new FolderPurgeResult(false, "Tên thư mục không hợp lệ.", 0);
        if (folder.Length > 512)
            return new FolderPurgeResult(false, "Tên thư mục quá dài.", 0);

        var docs = await _documents.GetActiveDocumentsInVirtualFolderAsync(folder).ConfigureAwait(false);
        if (docs.Count == 0)
            return new FolderPurgeResult(true, "Không có tài liệu đang hoạt động trong thư mục này.", 0);

        var ids = docs.Select(d => d.Id).ToList();
        var warnings = new List<string>();
        var storagePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var conn = await _db.GetOpenConnectionAsync(cancellationToken).ConfigureAwait(false);

        List<string> croppedRelPaths;
        try
        {
            var croppedRows = await conn.QueryAsync<string>(
                new CommandDefinition(
                    """
                    SELECT cropped_path
                    FROM dbo.stg_form_cells
                    WHERE document_id IN @Ids
                      AND NULLIF(LTRIM(RTRIM(ISNULL(cropped_path, N''))), N'') IS NOT NULL;
                    """,
                    new { Ids = ids },
                    cancellationToken: cancellationToken)).ConfigureAwait(false);
            croppedRelPaths = croppedRows.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Đọc cropped_path trước khi purge thư mục {Folder}", folder);
            return new FolderPurgeResult(false, $"Lỗi đọc DB: {ex.Message}", 0);
        }

        foreach (var rel in croppedRelPaths.Where(x => !string.IsNullOrWhiteSpace(x)))
            storagePaths.Add(rel);

        foreach (var d in docs)
        {
            AddStoragePath(storagePaths, d.FilePath);
            AddStoragePath(storagePaths, d.ThumbPath);
            AddStoragePath(storagePaths, d.PathPdfSearchable);
            AddStoragePath(storagePaths, d.PathConverted);
            AddStoragePath(storagePaths, d.PathOriginal);
        }

        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.stg_form_cells WHERE document_id IN @Ids;",
                new { Ids = ids }, transaction: tx, cancellationToken: cancellationToken)).ConfigureAwait(false);
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.stg_doc_sohoa_page WHERE document_id IN @Ids;",
                new { Ids = ids }, transaction: tx, cancellationToken: cancellationToken)).ConfigureAwait(false);
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.stg_ocr_jobs WHERE document_id IN @Ids;",
                new { Ids = ids }, transaction: tx, cancellationToken: cancellationToken)).ConfigureAwait(false);

            var n = await conn.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.stg_documents
                SET status = @Deleted, updated = SYSUTCDATETIME(), updated_by = @UserId
                WHERE id IN @Ids AND status = @Active;
                """,
                new
                {
                    Ids = ids,
                    Deleted = (byte)DocumentStatus.Deleted,
                    Active = (byte)DocumentStatus.Active,
                    UserId = user.Id
                },
                transaction: tx,
                cancellationToken: cancellationToken)).ConfigureAwait(false);

            tx.Commit();

            if (n != ids.Count)
                warnings.Add($"Cập nhật DB: {n}/{ids.Count} bản ghi (một số có thể đã đổi trạng thái trước đó).");
        }
        catch (Exception ex)
        {
            try
            {
                tx.Rollback();
            }
            catch (Exception rbEx)
            {
                _logger.LogWarning(rbEx, "Rollback purge thư mục {Folder}", folder);
            }

            _logger.LogError(ex, "Lỗi purge thư mục {Folder}", folder);
            return new FolderPurgeResult(false, $"Lỗi khi xóa trong DB: {ex.Message}", 0);
        }

        var deletedAtUtc = DateTime.UtcNow;
        var storageWarnings = new List<string>();
        await Parallel.ForEachAsync(
            storagePaths,
            new ParallelOptions { MaxDegreeOfParallelism = StorageParallelism, CancellationToken = cancellationToken },
            async (rel, _) =>
            {
                try
                {
                    var marked = await _storage.MarkDeletedAsync(rel, deletedAtUtc).ConfigureAwait(false);
                    if (!marked)
                        lock (storageWarnings) { storageWarnings.Add(rel); }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không đổi tên được file storage: {Path}", rel);
                    lock (storageWarnings) { storageWarnings.Add(rel); }
                }
            }).ConfigureAwait(false);
        warnings.AddRange(storageWarnings);

        await Parallel.ForEachAsync(
            docs,
            new ParallelOptions { MaxDegreeOfParallelism = SearchParallelism, CancellationToken = cancellationToken },
            async (d, _) =>
            {
                try
                {
                    await _search.DeleteDocumentAsync(d.Id).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không gỡ được index ES cho tài liệu {Id}", d.Id);
                }
            }).ConfigureAwait(false);

        try
        {
            await _actionLog.LogAsync(new ActionLog
            {
                UserId = user.Id,
                UserName = user.UserName,
                Action = "PURGE_FOLDER",
                TableName = "stg_documents",
                RecordId = folder,
                NewValue = $"Removed {ids.Count} docs",
                Description = $"Xóa hàng loạt theo thư mục ảo: {folder}",
                CreatedAt = DateTime.UtcNow
            }).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không ghi được action log PURGE_FOLDER");
        }

        var msg = $"Đã xóa {ids.Count} tài liệu trong thư mục «{folder}» (CSDL). File storage được đổi tên hậu tố _deleteat.";
        return new FolderPurgeResult(true, msg, ids.Count, warnings.Count > 0 ? warnings : null);
    }

    private static void AddStoragePath(ISet<string> paths, string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;
        paths.Add(relativePath.Trim());
    }
}
