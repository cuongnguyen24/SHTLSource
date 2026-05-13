using Dapper;
using Microsoft.Extensions.Logging;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Log;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Log;
using SHTL.Modules.Infrastructure.Persistence;

namespace SHTL.Modules.Core.Application.Services;

public interface IFolderOcrRetryService
{
    /// <summary>
    /// Chạy lại OCR (PDF 2 lớp) cho mọi tài liệu có ocr_status = 13 (Failed) thuộc thư mục ảo.
    /// Trước khi đẩy vào hàng đợi, hàm sẽ tự kiểm tra các nguyên nhân thường gặp khiến OCR
    /// vừa retry là lập tức lỗi lại (không phải PDF, không có DPI số hóa, …) và bỏ qua những
    /// tài liệu đó để người dùng biết phải sửa dữ liệu trước khi retry.
    /// </summary>
    Task<FolderOcrRetryResult> RequeueFailedAsync(string virtualFolderName, ICurrentUser user, CancellationToken cancellationToken = default);
}

public sealed record FolderOcrRetryResult(
    bool Success,
    string Message,
    int DocumentsAffected,
    int DocumentsSkipped = 0);

public sealed class FolderOcrRetryService : IFolderOcrRetryService
{
    private readonly AppDbContext _db;
    private readonly IActionLogRepository _actionLog;
    private readonly ILogger<FolderOcrRetryService> _logger;

    public FolderOcrRetryService(
        AppDbContext db,
        IActionLogRepository actionLog,
        ILogger<FolderOcrRetryService> logger)
    {
        _db = db;
        _actionLog = actionLog;
        _logger = logger;
    }

    public async Task<FolderOcrRetryResult> RequeueFailedAsync(string virtualFolderName, ICurrentUser user, CancellationToken cancellationToken = default)
    {
        var folder = (virtualFolderName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(folder))
            return new FolderOcrRetryResult(false, "Tên thư mục không hợp lệ.", 0);
        if (folder.Length > 512)
            return new FolderOcrRetryResult(false, "Tên thư mục quá dài.", 0);

        // ── 1) Lấy danh sách tài liệu OCR-lỗi trong thư mục, kèm cờ chẩn đoán ──────────
        // - IsPdf      : kiểu file có phải PDF (theo extension / tên file / đường dẫn)
        // - HasDpi     : có dpi_x > 0 trên stg_doc_sohoa_page (worker Pdf2Layer cần DPI/trang)
        // - HasPath    : file_path không trống (worker cần đường dẫn tương đối hợp lệ)
        const string diagnoseSql = """
WITH base AS (
    SELECT
        id,
        ocr_status,
        ISNULL(extension, N'')    AS extension,
        ISNULL(file_name, N'')    AS file_name,
        ISNULL(file_path, N'')    AS file_path,
        REPLACE(COALESCE(NULLIF(path_original, N''), NULLIF(file_path, N''), N'Không rõ'), N'\', N'/') AS rel
    FROM dbo.stg_documents
    WHERE status = @Active
),
tagged AS (
    SELECT
        id, ocr_status, extension, file_name, file_path,
        CASE
            WHEN rel = N'' THEN N'(trống)'
            WHEN CHARINDEX(N'/', rel) > 0 THEN LEFT(rel, CHARINDEX(N'/', rel) - 1)
            ELSE rel
        END AS folder_name
    FROM base
),
failed AS (
    SELECT id, extension, file_name, file_path
    FROM tagged
    WHERE folder_name = @Folder AND ocr_status = @Failed
)
SELECT
    f.id AS Id,
    CASE
        WHEN LOWER(LTRIM(RTRIM(f.extension))) IN (N'pdf', N'.pdf')
          OR LOWER(f.file_name) LIKE N'%.pdf'
          OR LOWER(f.file_path) LIKE N'%.pdf'
        THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END                                AS IsPdf,
    CASE WHEN LTRIM(RTRIM(f.file_path)) <> N'' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasPath,
    CASE WHEN EXISTS (
        SELECT 1 FROM dbo.stg_doc_sohoa_page p
        WHERE p.document_id = f.id AND p.dpi_x > 0
    ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END                                   AS HasDpi
FROM failed f;
""";

        IReadOnlyList<DiagnosticRow> diagnostics;
        try
        {
            var conn = await _db.GetOpenConnectionAsync(cancellationToken).ConfigureAwait(false);
            diagnostics = (await conn.QueryAsync<DiagnosticRow>(new CommandDefinition(
                diagnoseSql,
                new
                {
                    Folder = folder,
                    Failed = (byte)OcrStatus.SearchablePdfFailed,
                    Active = (byte)DocumentStatus.Active
                },
                cancellationToken: cancellationToken)).ConfigureAwait(false)).AsList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Chẩn đoán OCR-lỗi thất bại cho thư mục {Folder}", folder);
            return new FolderOcrRetryResult(false, $"Lỗi đọc DB khi chẩn đoán: {ex.Message}", 0);
        }

        if (diagnostics.Count == 0)
            return new FolderOcrRetryResult(true, "Không có tài liệu OCR lỗi nào trong thư mục này.", 0);

        // ── 2) Phân loại retryable / skip ───────────────────────────────────────────
        var retryableIds = new List<long>(diagnostics.Count);
        var skipNotPdf = 0;
        var skipNoPath = 0;
        var skipNoDpi = 0;

        foreach (var d in diagnostics)
        {
            if (!d.HasPath) { skipNoPath++; continue; }
            if (!d.IsPdf)   { skipNotPdf++; continue; }
            if (!d.HasDpi)  { skipNoDpi++; continue; }
            retryableIds.Add(d.Id);
        }

        // ── 3) Re-queue đúng tập retryable ──────────────────────────────────────────
        int affected = 0;
        if (retryableIds.Count > 0)
        {
            const string updateSql = """
UPDATE dbo.stg_documents
SET ocr_status = @Queued,
    path_pdf_searchable = NULL,
    ocr_at = NULL,
    updated = SYSUTCDATETIME(),
    updated_by = @UserId
WHERE id IN @Ids
  AND ocr_status = @Failed;
""";
            try
            {
                var conn = await _db.GetOpenConnectionAsync(cancellationToken).ConfigureAwait(false);
                affected = await conn.ExecuteAsync(new CommandDefinition(
                    updateSql,
                    new
                    {
                        Ids = retryableIds,
                        Queued = (byte)OcrStatus.SearchablePdfQueued,
                        Failed = (byte)OcrStatus.SearchablePdfFailed,
                        UserId = user.Id
                    },
                    cancellationToken: cancellationToken)).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Re-queue OCR thất bại cho thư mục {Folder}", folder);
                return new FolderOcrRetryResult(false, $"Lỗi cập nhật DB: {ex.Message}", 0);
            }
        }

        // ── 4) Ghi log hành động ────────────────────────────────────────────────────
        try
        {
            await _actionLog.LogAsync(new ActionLog
            {
                UserId = user.Id,
                UserName = user.UserName,
                Action = "OCR_RETRY_FOLDER",
                TableName = "stg_documents",
                RecordId = folder,
                NewValue = $"Requeued {affected}, skipped: NotPdf={skipNotPdf}, NoPath={skipNoPath}, NoDpi={skipNoDpi}",
                Description = $"Chạy lại OCR cho các tài liệu lỗi trong thư mục: {folder}",
                CreatedAt = DateTime.UtcNow
            }).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không ghi được action log OCR_RETRY_FOLDER");
        }

        // ── 5) Soạn thông điệp người dùng dễ hiểu ───────────────────────────────────
        var totalSkipped = skipNotPdf + skipNoPath + skipNoDpi;
        var msg = BuildUserMessage(folder, affected, totalSkipped, skipNotPdf, skipNoPath, skipNoDpi);
        return new FolderOcrRetryResult(true, msg, affected, totalSkipped);
    }

    private static string BuildUserMessage(
        string folder,
        int requeued,
        int totalSkipped,
        int skipNotPdf,
        int skipNoPath,
        int skipNoDpi)
    {
        var parts = new List<string>();

        if (requeued > 0)
            parts.Add($"Đã đưa {requeued} tài liệu trở lại hàng đợi OCR.");
        else if (totalSkipped > 0)
            parts.Add("Không có tài liệu nào được đưa lại hàng đợi vì tất cả đều có lỗi dữ liệu (xem chi tiết bên dưới).");

        if (totalSkipped > 0)
        {
            var reasons = new List<string>();
            if (skipNoDpi  > 0) reasons.Add($"{skipNoDpi} thiếu DPI số hóa (stg_doc_sohoa_page.dpi_x)");
            if (skipNotPdf > 0) reasons.Add($"{skipNotPdf} không phải tệp PDF");
            if (skipNoPath > 0) reasons.Add($"{skipNoPath} thiếu đường dẫn file_path");

            parts.Add($"Bỏ qua {totalSkipped} tài liệu (sẽ vẫn lỗi nếu retry): {string.Join("; ", reasons)}.");
            parts.Add("Hãy sửa các vấn đề dữ liệu trên rồi chạy lại OCR.");
        }

        if (parts.Count == 0)
            parts.Add($"Không có tài liệu OCR lỗi nào trong thư mục «{folder}».");

        return string.Join(" ", parts);
    }

    private sealed class DiagnosticRow
    {
        public long Id { get; set; }
        public bool IsPdf { get; set; }
        public bool HasPath { get; set; }
        public bool HasDpi { get; set; }
    }
}
