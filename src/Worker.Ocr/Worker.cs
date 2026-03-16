using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Stg;

namespace Worker.Ocr;

/// <summary>
/// OCR worker stub: currently just marks queued OCR jobs as Done.
/// Later will integrate real OCR engine & update core_stg.ocr_results.
/// </summary>
public class OcrWorker : BackgroundService
{
    private readonly ILogger<OcrWorker> _logger;
    private readonly IOcrJobRepository _ocrRepo;
    private readonly IConfiguration _cfg;

    public OcrWorker(ILogger<OcrWorker> logger, IOcrJobRepository ocrRepo, IConfiguration cfg)
    {
        _logger = logger;
        _ocrRepo = ocrRepo;
        _cfg = cfg;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(_cfg.GetValue("Worker:IntervalSeconds", 5));
        var batchSize = _cfg.GetValue("Worker:BatchSize", 10);

        _logger.LogInformation("Worker.Ocr started. Interval={interval}s BatchSize={batch}", interval.TotalSeconds, batchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var jobs = await _ocrRepo.GetPendingAsync(batchSize);
                foreach (var j in jobs)
                {
                    await _ocrRepo.UpdateStatusAsync(j.Id, QueueStatus.Processing, "Processing (stub)");
                    // TODO: call OCR engine
                    await Task.Delay(50, stoppingToken);
                    await _ocrRepo.UpdateStatusAsync(j.Id, QueueStatus.Done, "Done (stub)");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker.Ocr tick failed");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
