using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace SHTL.Service.Ocr;

internal sealed class OcrProcessor
{
    private readonly OcrServiceJobRepository _repo;
    private readonly WorkerFileStorage _storage;
    private readonly IOptions<StorageOptions> _storageOpts;
    private readonly IOptions<OcrSearchablePdfWorkerOptions> _pdfOpts;
    private readonly OcrPythonRunner _runner;
    private readonly OcrZoneFieldFillService _zoneFieldFill;
    private readonly ILogger<OcrProcessor> _logger;

    public OcrProcessor(
        OcrServiceJobRepository repo,
        WorkerFileStorage storage,
        IOptions<StorageOptions> storageOpts,
        IOptions<OcrSearchablePdfWorkerOptions> pdfOpts,
        OcrPythonRunner runner,
        OcrZoneFieldFillService zoneFieldFill,
        ILogger<OcrProcessor> logger)
    {
        _repo = repo;
        _storage = storage;
        _storageOpts = storageOpts;
        _pdfOpts = pdfOpts;
        _runner = runner;
        _zoneFieldFill = zoneFieldFill;
        _logger = logger;
    }

    public async Task ProcessAsync(long documentId, CancellationToken cancellationToken = default)
    {
        var doc = await _repo.GetByIdAsync(documentId, cancellationToken).ConfigureAwait(false);
        if (doc is null)
        {
            _logger.LogWarning("OcrService: tài liệu {Id} không tồn tại", documentId);
            await LogDocAsync(documentId, "WARN", "CLAIM_ORPHAN", "Tài liệu không tồn tại trong DB sau khi claim (có thể đã xóa).").ConfigureAwait(false);
            return;
        }

        if (doc.OcrStatus != (byte)OcrOcrStatus.OcrSearchablePdfProcessing)
        {
            _logger.LogDebug("OcrService: bỏ qua id={Id}, ocr_status={Status}", documentId, doc.OcrStatus);
            await LogDocAsync(documentId, "WARN", "STATUS_MISMATCH",
                $"Bỏ qua xử lý: ocr_status hiện tại={doc.OcrStatus}, kỳ vọng={(byte)OcrOcrStatus.OcrSearchablePdfProcessing} (Processing). Có thể đã được cập nhật từ nơi khác.")
                .ConfigureAwait(false);
            return;
        }

        if (!OcrSearchablePdfPathHelper.LooksLikePdf(doc.Extension, doc.FileName, doc.FilePath)
            || string.IsNullOrWhiteSpace(doc.FilePath))
        {
            await LogDocAsync(documentId, "ERROR", "NOT_PDF_OR_EMPTY_PATH",
                $"Không hợp lệ để tạo PDF 2 lớp. extension={doc.Extension}; file={doc.FileName}; path={doc.FilePath}")
                .ConfigureAwait(false);
            await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfFailed, null, 0, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var inputFull = ResolveSafeFullPath(doc.FilePath);
        if (inputFull is null || !File.Exists(inputFull))
        {
            _logger.LogError("OcrService: không đọc file gốc id={Id} path={Path}", documentId, doc.FilePath);
            await LogDocAsync(documentId, "ERROR", "FILE_NOT_ON_DISK",
                $"Không đọc được file gốc. db_path={doc.FilePath}; resolved={(inputFull ?? "(null — path traversal / ngoài RootPath)")}; storageRoot={_storageOpts.Value.RootPath}")
                .ConfigureAwait(false);
            await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfFailed, null, 0, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var dpiFromPage = await _repo.GetPreferredDpiAsync(documentId, cancellationToken).ConfigureAwait(false);
        if (!dpiFromPage.HasValue || dpiFromPage.Value <= 0)
        {
            _logger.LogError("OcrService: không có DPI theo trang cho tài liệu id={Id}", documentId);
            await LogDocAsync(documentId, "ERROR", "NO_DPI_SOHOA",
                "Không có dpi_x hợp lệ trên stg_doc_sohoa_page (cần số hóa lưu DPI theo trang trước).")
                .ConfigureAwait(false);
            await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfFailed, null, 0, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var dpi = Math.Clamp(dpiFromPage.Value, 72, 300);
        var maxPages = await ResolveMaxPagesAsync(cancellationToken).ConfigureAwait(false);
        var selectedPages = await _repo.GetConfiguredOcrPagesAsync(doc.DocTypeId, cancellationToken).ConfigureAwait(false);
        var tempOut = Path.Combine(Path.GetTempPath(), $"shtl-searchable-{documentId}-{Guid.NewGuid():N}.pdf");
        var tempOcrJson = Path.Combine(Path.GetTempPath(), $"shtl-ocr-items-{documentId}-{Guid.NewGuid():N}.json");
        try
        {
            _logger.LogInformation("OcrService: đang xử lý id={Id}", documentId);
            await LogDocAsync(documentId, "INFO", "START",
                $"Bắt đầu xử lý. input={inputFull}; dpi={dpi}; maxPages={(maxPages <= 0 ? "ALL" : maxPages.ToString())}; selectedPages={(selectedPages.Count == 0 ? "AUTO_ALL" : string.Join(",", selectedPages))}")
                .ConfigureAwait(false);
            var run = await _runner.RunAsync(inputFull, tempOut, dpi, maxPages, selectedPages, tempOcrJson, cancellationToken).ConfigureAwait(false);
            if (!run.Ok)
            {
                await LogDocAsync(documentId, "ERROR", "PYTHON_OR_RUNNER", run.Reason).ConfigureAwait(false);
                await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfFailed, null, 0, cancellationToken)
                    .ConfigureAwait(false);
                return;
            }

            var ocrItems = await ReadOcrItemsAsync(tempOcrJson, cancellationToken).ConfigureAwait(false);
            var fill = ocrItems.Count > 0
                ? await _zoneFieldFill.FillFromOcrItemsAsync(documentId, doc.DocTypeId, ocrItems, cancellationToken).ConfigureAwait(false)
                : await _zoneFieldFill.FillAsync(documentId, doc.DocTypeId, tempOut, cancellationToken).ConfigureAwait(false);
            if (fill.Success)
            {
                await LogDocAsync(documentId, "INFO", "ZONE_FILL", $"Filled OCR zones: {fill.FilledCount} field(s). {fill.Reason}").ConfigureAwait(false);
            }
            else
            {
                await LogDocAsync(documentId, "WARN", "ZONE_FILL_EMPTY", $"OCR done but no DB field filled. {fill.Reason}").ConfigureAwait(false);
            }

            string storedRel;
            await using (var readStream = new FileStream(tempOut, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var rel = doc.FilePath!.Replace('\\', '/');
                var sub = Path.GetDirectoryName(rel)?.Replace('\\', '/') ?? "";
                var baseName = Path.GetFileNameWithoutExtension(doc.FileName ?? Path.GetFileName(rel));
                if (string.IsNullOrWhiteSpace(baseName))
                    baseName = $"doc-{documentId}";
                var outFile = $"{baseName}_searchable.pdf";

                storedRel = await _storage.SaveFileAsync(readStream, outFile, sub, cancellationToken).ConfigureAwait(false);
                await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfReady, storedRel, 0, cancellationToken)
                    .ConfigureAwait(false);
            }

            if (File.Exists(tempOcrJson))
            {
                var ocrJsonRel = BuildOcrJsonRelativePath(storedRel);
                await using var jsonStream = new FileStream(tempOcrJson, FileMode.Open, FileAccess.Read, FileShare.Read);
                await _storage.SaveExactFileAsync(jsonStream, ocrJsonRel, cancellationToken).ConfigureAwait(false);
                await LogDocAsync(documentId, "INFO", "OCR_JSON", $"Saved raw OCR items. path={ocrJsonRel}").ConfigureAwait(false);
            }

            _logger.LogInformation("OcrService: hoàn tất id={Id} → {Path}", documentId, storedRel);
            await LogDocAsync(documentId, "INFO", "DONE", $"Hoàn tất. output={storedRel}").ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Service đang dừng — KHÔNG đánh dấu Failed. Document ở trạng thái Processing (11),
            // stale-reset khi khởi động lại sẽ đưa nó về Queued (10) để xử lý tiếp.
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OcrService: lỗi id={Id}", documentId);
            await LogDocAsync(documentId, "ERROR", "EXCEPTION", $"{ex.GetType().Name}: {ex.Message}", ex).ConfigureAwait(false);
            // Dùng CancellationToken.None để đảm bảo update luôn thành công,
            // tránh trường hợp token vừa bị cancel ngay lúc ghi DB.
            await _repo.UpdateOcrSearchablePdfStateAsync(documentId, OcrOcrStatus.OcrSearchablePdfFailed, null, 0, CancellationToken.None)
                .ConfigureAwait(false);
        }
        finally
        {
            try
            {
                if (File.Exists(tempOut))
                    File.Delete(tempOut);
                if (File.Exists(tempOcrJson))
                    File.Delete(tempOcrJson);
            }
            catch
            {
                // ignore
            }
        }
    }

    private static string BuildOcrJsonRelativePath(string searchablePdfPath)
    {
        var rel = searchablePdfPath.Replace('\\', '/').TrimStart('/');
        var dir = Path.GetDirectoryName(rel)?.Replace('\\', '/') ?? string.Empty;
        var fileName = Path.GetFileNameWithoutExtension(rel);
        var jsonFile = $"{fileName}_ocr.json";
        return string.IsNullOrWhiteSpace(dir) ? jsonFile : $"{dir}/{jsonFile}";
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

    private async Task<int> ResolveMaxPagesAsync(CancellationToken cancellationToken)
    {
        var fallback = _pdfOpts.Value.NumberOfPagesRunInOcrService;
        try
        {
            var raw = await _repo.GetConfigValueAsync("NumberOfPagesRunInOcrService", cancellationToken).ConfigureAwait(false);
            if (int.TryParse(raw, out var parsed))
                return parsed <= 0 ? 0 : Math.Clamp(parsed, 1, 5000);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OcrService: không đọc được config NumberOfPagesRunInOcrService từ DB, dùng fallback.");
        }

        return fallback <= 0 ? 0 : Math.Clamp(fallback, 1, 5000);
    }

    private async Task<IReadOnlyList<OcrTextItem>> ReadOcrItemsAsync(string path, CancellationToken cancellationToken)
    {
        try
        {
            if (!File.Exists(path))
                return Array.Empty<OcrTextItem>();

            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var items = await JsonSerializer.DeserializeAsync<List<OcrTextItem>>(stream, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            return items is { Count: > 0 } ? items : Array.Empty<OcrTextItem>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OcrService: không đọc được JSON OCR items {Path}, fallback đọc PDF layer", path);
            return Array.Empty<OcrTextItem>();
        }
    }

    /// <summary>Ghi log file AppData với mã lỗi cố định để tra cứu nhanh (dashboard chỉ thấy ocr_status=13).</summary>
    private static Task LogDocAsync(long documentId, string level, string reasonCode, string detail, Exception? ex = null)
    {
        var line = $"[doc #{documentId}] [{reasonCode}] {detail}";
        return AppDataFileLog.WriteAsync(level, line, ex);
    }
}
