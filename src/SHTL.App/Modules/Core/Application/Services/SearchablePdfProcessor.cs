using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;

namespace SHTL.Modules.Core.Application.Services;

public interface ISearchablePdfProcessor
{
    Task ProcessAsync(long documentId, CancellationToken cancellationToken = default);
}

/// <summary>Đọc file scan, gọi Python tạo PDF có lớp chữ, lưu storage và cập nhật DB.</summary>
public sealed class SearchablePdfProcessor : ISearchablePdfProcessor
{
    private readonly IDocumentRepository _documents;
    private readonly IDocumentPageRepository _documentPages;
    private readonly IStorageService _storage;
    private readonly IOptions<StorageOptions> _storageOpts;
    private readonly ISearchablePdfPythonRunner _runner;
    private readonly IDocTypeOcrZoneExtractionService _ocrZoneExtraction;
    private readonly ILogger<SearchablePdfProcessor> _logger;

    public SearchablePdfProcessor(
        IDocumentRepository documents,
        IDocumentPageRepository documentPages,
        IStorageService storage,
        IOptions<StorageOptions> storageOpts,
        ISearchablePdfPythonRunner runner,
        IDocTypeOcrZoneExtractionService ocrZoneExtraction,
        ILogger<SearchablePdfProcessor> logger)
    {
        _documents = documents;
        _documentPages = documentPages;
        _storage = storage;
        _storageOpts = storageOpts;
        _runner = runner;
        _ocrZoneExtraction = ocrZoneExtraction;
        _logger = logger;
    }

    public async Task ProcessAsync(long documentId, CancellationToken cancellationToken = default)
    {
        var doc = await _documents.GetByIdAsync(documentId).ConfigureAwait(false);
        if (doc is null)
        {
            _logger.LogWarning("Searchable PDF: tài liệu {Id} không tồn tại", documentId);
            return;
        }

        if (doc.OcrStatus != OcrStatus.SearchablePdfProcessing)
        {
            _logger.LogDebug("Searchable PDF: bỏ qua id={Id}, trạng thái {Status}", documentId, doc.OcrStatus);
            return;
        }

        if (!SearchablePdfDisplay.LooksLikePdf(doc.Extension, doc.FileName, doc.FilePath)
            || string.IsNullOrWhiteSpace(doc.FilePath))
        {
            await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfFailed, null, 0)
                .ConfigureAwait(false);
            return;
        }

        var inputFull = ResolveSafeFullPath(doc.FilePath);
        if (inputFull is null || !File.Exists(inputFull))
        {
            _logger.LogError("Searchable PDF: không đọc được file gốc id={Id} path={Path}", documentId, doc.FilePath);
            await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfFailed, null, 0)
                .ConfigureAwait(false);
            return;
        }

        var dpiFromPage = await _documentPages.GetPreferredDpiAsync(documentId).ConfigureAwait(false);
        if (!dpiFromPage.HasValue || dpiFromPage.Value <= 0)
        {
            _logger.LogError("Searchable PDF: không có DPI theo trang cho tài liệu id={Id}", documentId);
            await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfFailed, null, 0)
                .ConfigureAwait(false);
            return;
        }

        var dpi = Math.Clamp((int)Math.Round(dpiFromPage.Value), 72, 300);
        var tempOut = Path.Combine(Path.GetTempPath(), $"shtl-searchable-{documentId}-{Guid.NewGuid():N}.pdf");
        try
        {
            _logger.LogInformation("Searchable PDF: đang xử lý id={Id}", documentId);
            var ok = await _runner.RunAsync(inputFull, tempOut, dpi, cancellationToken).ConfigureAwait(false);
            if (!ok)
            {
                await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfFailed, null, 0)
                    .ConfigureAwait(false);
                return;
            }

            string? storedRel;
            await using (var readStream = new FileStream(tempOut, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var rel = doc.FilePath.Replace('\\', '/');
                var sub = Path.GetDirectoryName(rel)?.Replace('\\', '/') ?? "";
                var baseName = Path.GetFileNameWithoutExtension(doc.FileName ?? Path.GetFileName(rel));
                if (string.IsNullOrWhiteSpace(baseName))
                    baseName = $"doc-{documentId}";
                var outFile = $"{baseName}_searchable.pdf";

                storedRel = await _storage.SaveFileAsync(readStream, outFile, sub).ConfigureAwait(false);
                await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfReady, storedRel, 0)
                    .ConfigureAwait(false);
            }

            await _ocrZoneExtraction.TryPrefillDocumentFromConfiguredZonesAsync(documentId, cancellationToken)
                .ConfigureAwait(false);

            _logger.LogInformation("Searchable PDF: hoàn tất id={Id} → {Path}", documentId, storedRel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Searchable PDF: lỗi id={Id}", documentId);
            await _documents.UpdateSearchablePdfStateAsync(documentId, OcrStatus.SearchablePdfFailed, null, 0)
                .ConfigureAwait(false);
        }
        finally
        {
            try
            {
                if (File.Exists(tempOut))
                    File.Delete(tempOut);
            }
            catch
            {
                // ignore
            }
        }
    }

    private string? ResolveSafeFullPath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return null;
        var root = Path.GetFullPath(_storageOpts.Value.RootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var combined = Path.GetFullPath(Path.Combine(root, relativePath.TrimStart('/', '\\')));
        var rootPrefix = root + Path.DirectorySeparatorChar;
        var ok = combined.Equals(root, StringComparison.OrdinalIgnoreCase)
                 || combined.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase);
        return ok ? combined : null;
    }
}
