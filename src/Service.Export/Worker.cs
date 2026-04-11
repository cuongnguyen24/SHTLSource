using Core.Domain.Enums;
using Core.Domain.Contracts;
using Infrastructure.Data.Repositories.Stg;
using Service.Export.Exporters;
using Shared.Contracts;

namespace Service.Export;

public class ExportWorker : BackgroundService
{
    private readonly ILogger<ExportWorker> _logger;
    private readonly IExportJobRepository _exportRepo;
    private readonly IExportTypeRepository _exportTypeRepo;
    private readonly IDocumentRepository _docRepo;
    private readonly IStorageService _storage;
    private readonly IConfiguration _cfg;

    public ExportWorker(
        ILogger<ExportWorker> logger,
        IExportJobRepository exportRepo,
        IExportTypeRepository exportTypeRepo,
        IDocumentRepository docRepo,
        IStorageService storage,
        IConfiguration cfg)
    {
        _logger = logger;
        _exportRepo = exportRepo;
        _exportTypeRepo = exportTypeRepo;
        _docRepo = docRepo;
        _storage = storage;
        _cfg = cfg;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(_cfg.GetValue("Worker:IntervalSeconds", 5));
        var batchSize = _cfg.GetValue("Worker:BatchSize", 5);

        _logger.LogInformation("Service.Export started. Interval={interval}s BatchSize={batch}", interval.TotalSeconds, batchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var jobs = await _exportRepo.GetPendingAsync(batchSize);
                foreach (var job in jobs)
                {
                    await ProcessJobAsync(job);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Service.Export tick failed");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    private async Task ProcessJobAsync(Core.Domain.Entities.Stg.ExportJob job)
    {
        try
        {
            _logger.LogInformation("Processing export job {JobId}, Type={TypeId}", job.Id, job.ExportTypeId);

            // Update status to Processing
            await _exportRepo.UpdateProgressAsync(job.Id, 0, 0, 0, QueueStatus.Processing, null, "Processing");

            // Load ExportType
            var exportType = await _exportTypeRepo.GetByIdAsync(job.ExportTypeId);
            if (exportType == null)
            {
                await _exportRepo.UpdateProgressAsync(job.Id, 0, 0, 0, QueueStatus.Error, null, 
                    $"ExportType {job.ExportTypeId} not found");
                return;
            }

            // Create exporter instance based on type
            var exporter = CreateExporter(job, exportType);
            if (exporter == null)
            {
                await _exportRepo.UpdateProgressAsync(job.Id, 0, 0, 0, QueueStatus.Error, null, 
                    $"No exporter found for type {exportType.Code}");
                return;
            }

            // Execute export
            var result = await exporter.ExecuteAsync();

            // Update job with result
            await _exportRepo.UpdateProgressAsync(
                job.Id,
                processed: result.Processed,
                success: result.SuccessCount,
                error: result.ErrorCount,
                status: result.Success ? QueueStatus.Done : QueueStatus.Error,
                downloadPath: result.DownloadPath,
                message: result.Message ?? result.Error);

            _logger.LogInformation("Export job {JobId} completed. Success={Success}, Processed={Processed}", 
                job.Id, result.Success, result.Processed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process export job {JobId}", job.Id);
            await _exportRepo.UpdateProgressAsync(job.Id, 0, 0, 0, QueueStatus.Error, null, 
                $"Exception: {ex.Message}");
        }
    }

    private BaseExporter? CreateExporter(Core.Domain.Entities.Stg.ExportJob job, Core.Domain.Entities.Stg.ExportType exportType)
    {
        // TODO: Factory pattern để tạo exporter dựa trên exportType.Code
        // Hiện tại return null, sẽ implement các exporter cụ thể sau
        _logger.LogWarning("CreateExporter not implemented yet for type {Code}", exportType.Code);
        return null;
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
