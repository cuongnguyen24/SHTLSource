using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SHTL.Exporting;

namespace SHTL.Service.Export;

internal sealed class ExportWorkerHostedService : BackgroundService
{
    private readonly ExportQueueRepository _repo;
    private readonly ILoggerFactory _loggerFactory;
    private readonly IConfiguration _configuration;
    private readonly IOptionsMonitor<ExportWorkerServiceOptions> _workerOptions;

    public ExportWorkerHostedService(
        ExportQueueRepository repo,
        ILoggerFactory loggerFactory,
        IConfiguration configuration,
        IOptionsMonitor<ExportWorkerServiceOptions> workerOptions)
    {
        _repo = repo;
        _loggerFactory = loggerFactory;
        _configuration = configuration;
        _workerOptions = workerOptions;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var log = _loggerFactory.CreateLogger<ExportWorkerHostedService>();
        log.LogInformation("SHTL.Service.Export started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            var opt = _workerOptions.CurrentValue;
            var delay = TimeSpan.FromSeconds(Math.Clamp(opt.PollIntervalSeconds, 2, 120));

            if (!opt.Enabled)
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            try
            {
                var jobs = await _repo.GetPendingAsync(Math.Clamp(opt.BatchSize, 1, 50), stoppingToken)
                    .ConfigureAwait(false);
                foreach (var row in jobs)
                {
                    await ProcessOneAsync(row, stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Export worker loop");
            }

            await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
        }
    }

    private async Task ProcessOneAsync(ExportJobRow row, CancellationToken ct)
    {
        var log = _loggerFactory.CreateLogger<ExportWorkerHostedService>();
        var jobId = row.Id;

        try
        {
            await _repo.UpdateProgressAsync(jobId, 0, 0, 0, 1, null, "Processing", ct).ConfigureAwait(false);

            var typeRow = await _repo.GetExportTypeAsync(row.ExportTypeId, ct).ConfigureAwait(false);
            if (typeRow == null)
            {
                var msg = $"ExportType {row.ExportTypeId} not found";
                ExportErrorFileLog.Append(jobId, row.ExportTypeId, null, msg, null);
                await _repo.UpdateProgressAsync(jobId, 0, 0, 0, 3, null, msg, ct).ConfigureAwait(false);
                return;
            }

            var jobCtx = ExportQueueRepository.ToContext(row);
            var typeCtx = ExportQueueRepository.ToContext(typeRow);
            var exporterLogger = _loggerFactory.CreateLogger<StubExporter>();
            BaseExporter exporter = new StubExporter(exporterLogger, _configuration, jobCtx, typeCtx);

            var result = await exporter.ExecuteAsync().ConfigureAwait(false);

            var statusMsg = result.Message ?? result.Error;
            await _repo.UpdateProgressAsync(
                jobId,
                result.Processed,
                result.SuccessCount,
                result.ErrorCount,
                result.Success ? (byte)2 : (byte)3,
                result.DownloadPath,
                statusMsg,
                ct).ConfigureAwait(false);

            if (!result.Success)
            {
                ExportErrorFileLog.Append(jobId, row.ExportTypeId, typeRow.Code,
                    statusMsg ?? "Export failed",
                    result.Error);
                log.LogWarning(
                    "Export job {JobId} failed code={Code} msg={Msg} detail={Detail}",
                    jobId,
                    typeRow.Code,
                    statusMsg,
                    result.Error ?? "");
            }

            log.LogInformation("Export job {JobId} done. Success={Ok}", jobId, result.Success);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Export job {JobId} failed", jobId);
            ExportErrorFileLog.Append(jobId, row.ExportTypeId, null, ex.Message, ex.ToString());
            await _repo.UpdateProgressAsync(jobId, 0, 0, 0, 3, null, ex.Message, ct).ConfigureAwait(false);
        }
    }
}
