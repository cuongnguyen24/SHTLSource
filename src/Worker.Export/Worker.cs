using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Stg;
using Shared.Contracts;

namespace Worker.Export;

public class ExportWorker : BackgroundService
{
    private readonly ILogger<ExportWorker> _logger;
    private readonly IExportJobRepository _exportRepo;
    private readonly IDocumentRepository _docRepo;
    private readonly Core.Domain.Contracts.IStorageService _storage;
    private readonly IConfiguration _cfg;

    public ExportWorker(
        ILogger<ExportWorker> logger,
        IExportJobRepository exportRepo,
        IDocumentRepository docRepo,
        Core.Domain.Contracts.IStorageService storage,
        IConfiguration cfg)
    {
        _logger = logger;
        _exportRepo = exportRepo;
        _docRepo = docRepo;
        _storage = storage;
        _cfg = cfg;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(_cfg.GetValue("Worker:IntervalSeconds", 5));
        var batchSize = _cfg.GetValue("Worker:BatchSize", 50);
        var exportSubPath = _cfg["Worker:ExportSubPath"] ?? "exports";

        _logger.LogInformation("Worker.Export started. Interval={interval}s BatchSize={batch}", interval.TotalSeconds, batchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var jobs = await _exportRepo.GetPendingAsync(5);
                foreach (var job in jobs)
                {
                    await _exportRepo.UpdateProgressAsync(job.Id, 0, 0, 0, QueueStatus.Processing, null, "Processing");

                    // Minimal export: export documents of the channel as CSV snapshot
                    var docs = await _docRepo.GetListAsync(job.ChannelId,
                        new DocumentFilterParams { },
                        pageIndex: 1,
                        pageSize: batchSize);

                    var csv = BuildCsv(docs);
                    await using var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(csv));

                    var fileName = $"export_{job.ChannelId}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";
                    var sub = Path.Combine(exportSubPath, job.ChannelId.ToString(), DateTime.UtcNow.ToString("yyyyMMdd"));
                    var stored = await _storage.SaveFileAsync(ms, fileName, sub);
                    var url = await _storage.GetPublicUrlAsync(stored);

                    await _exportRepo.UpdateProgressAsync(job.Id,
                        processed: docs.Count(),
                        success: docs.Count(),
                        error: 0,
                        status: QueueStatus.Done,
                        downloadPath: stored,
                        message: url);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker.Export tick failed");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    private static string BuildCsv(IEnumerable<Core.Domain.Entities.Stg.Document> docs)
    {
        static string Esc(string? s)
        {
            s ??= string.Empty;
            if (s.Contains('"') || s.Contains(',') || s.Contains('\n') || s.Contains('\r'))
                return "\"" + s.Replace("\"", "\"\"") + "\"";
            return s;
        }

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Id,ChannelId,Name,SymbolNo,RecordNo,IssuedBy,Author,CurrentStep,Status,Created,CreatedBy,FilePath");
        foreach (var d in docs)
        {
            sb.AppendLine(string.Join(",",
                d.Id,
                d.ChannelId,
                Esc(d.Name),
                Esc(d.SymbolNo),
                Esc(d.RecordNo),
                Esc(d.IssuedBy),
                Esc(d.Author),
                d.CurrentStep,
                (byte)d.Status,
                d.Created.ToString("O"),
                d.CreatedBy,
                Esc(d.FilePath)
            ));
        }
        return sb.ToString();
    }
}
