using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2Processor
{
    private readonly Pdf2LayerJobRepository _repo;
    private readonly WorkerFileStorage _storage;
    private readonly IOptions<StorageOptions> _storageOpts;
    private readonly IOptions<SearchablePdfWorkerOptions> _pdfOpts;
    private readonly Pdf2PythonRunner _runner;
    private readonly ILogger<Pdf2Processor> _logger;

    public Pdf2Processor(
        Pdf2LayerJobRepository repo,
        WorkerFileStorage storage,
        IOptions<StorageOptions> storageOpts,
        IOptions<SearchablePdfWorkerOptions> pdfOpts,
        Pdf2PythonRunner runner,
        ILogger<Pdf2Processor> logger)
    {
        _repo = repo;
        _storage = storage;
        _storageOpts = storageOpts;
        _pdfOpts = pdfOpts;
        _runner = runner;
        _logger = logger;
    }

    public async Task ProcessAsync(long documentId, CancellationToken cancellationToken = default)
    {
        var doc = await _repo.GetByIdAsync(documentId, cancellationToken).ConfigureAwait(false);
        if (doc is null)
        {
            _logger.LogWarning("Pdf2Layer: tài liệu {Id} không tồn tại", documentId);
            return;
        }

        if (doc.OcrStatus != (byte)Pdf2OcrStatus.SearchablePdfProcessing)
        {
            _logger.LogDebug("Pdf2Layer: bỏ qua id={Id}, ocr_status={Status}", documentId, doc.OcrStatus);
            return;
        }

        if (!SearchablePdfPathHelper.LooksLikePdf(doc.Extension, doc.FileName, doc.FilePath)
            || string.IsNullOrWhiteSpace(doc.FilePath))
        {
            await _repo.UpdateSearchablePdfStateAsync(documentId, Pdf2OcrStatus.SearchablePdfFailed, null, 0, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var inputFull = ResolveSafeFullPath(doc.FilePath);
        if (inputFull is null || !File.Exists(inputFull))
        {
            _logger.LogError("Pdf2Layer: không đọc file gốc id={Id} path={Path}", documentId, doc.FilePath);
            await _repo.UpdateSearchablePdfStateAsync(documentId, Pdf2OcrStatus.SearchablePdfFailed, null, 0, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var dpi = Math.Clamp(_pdfOpts.Value.RenderDpi, 72, 300);
        var tempOut = Path.Combine(Path.GetTempPath(), $"shtl-searchable-{documentId}-{Guid.NewGuid():N}.pdf");
        try
        {
            _logger.LogInformation("Pdf2Layer: đang xử lý id={Id}", documentId);
            var ok = await _runner.RunAsync(inputFull, tempOut, dpi, cancellationToken).ConfigureAwait(false);
            if (!ok)
            {
                await _repo.UpdateSearchablePdfStateAsync(documentId, Pdf2OcrStatus.SearchablePdfFailed, null, 0, cancellationToken)
                    .ConfigureAwait(false);
                return;
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
                await _repo.UpdateSearchablePdfStateAsync(documentId, Pdf2OcrStatus.SearchablePdfReady, storedRel, 0, cancellationToken)
                    .ConfigureAwait(false);
            }

            _logger.LogInformation("Pdf2Layer: hoàn tất id={Id} → {Path}", documentId, storedRel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Pdf2Layer: lỗi id={Id}", documentId);
            await _repo.UpdateSearchablePdfStateAsync(documentId, Pdf2OcrStatus.SearchablePdfFailed, null, 0, cancellationToken)
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
