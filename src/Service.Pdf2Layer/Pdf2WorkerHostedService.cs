using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2WorkerHostedService : BackgroundService
{
    private readonly Pdf2LayerJobRepository _repo;
    private readonly Pdf2Processor _processor;
    private readonly PythonDependencyBootstrapper _bootstrapper;
    private readonly IOptions<SearchablePdfWorkerOptions> _options;
    private readonly ILogger<Pdf2WorkerHostedService> _logger;

    public Pdf2WorkerHostedService(
        Pdf2LayerJobRepository repo,
        Pdf2Processor processor,
        PythonDependencyBootstrapper bootstrapper,
        IOptions<SearchablePdfWorkerOptions> options,
        ILogger<Pdf2WorkerHostedService> logger)
    {
        _repo = repo;
        _processor = processor;
        _bootstrapper = bootstrapper;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await AppDataFileLog.WriteAsync("INFO", "Pdf2Layer service started.").ConfigureAwait(false);
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken).ConfigureAwait(false);

        var ready = await _bootstrapper.EnsureReadyAsync(stoppingToken).ConfigureAwait(false);
        if (!ready)
        {
            _logger.LogError("Pdf2Layer: Python dependency chưa sẵn sàng, worker tạm ngưng vòng xử lý.");
            await AppDataFileLog.WriteAsync("ERROR", "Python dependency chưa sẵn sàng khi service khởi động.").ConfigureAwait(false);
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var opt = _options.Value;
            var delay = TimeSpan.FromSeconds(Math.Clamp(opt.PollIntervalSeconds, 2, 120));

            if (!opt.Enabled)
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            if (!ready)
            {
                ready = await _bootstrapper.EnsureReadyAsync(stoppingToken).ConfigureAwait(false);
                if (!ready)
                    await AppDataFileLog.WriteAsync("WARN", "Worker retry dependency: chưa sẵn sàng.").ConfigureAwait(false);
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            try
            {
                var stale = TimeSpan.FromMinutes(Math.Clamp(opt.StaleProcessingMinutes, 5, 240));
                var reset = await _repo.ResetStaleSearchablePdfProcessingAsync(stale, stoppingToken).ConfigureAwait(false);
                if (reset > 0)
                {
                    _logger.LogWarning("Pdf2Layer: phục hồi {Count} job bị kẹt", reset);
                    await AppDataFileLog.WriteAsync("WARN", $"Phục hồi {reset} job bị kẹt (stale processing).").ConfigureAwait(false);
                }

                var id = await _repo.TryClaimSearchablePdfJobAsync(stoppingToken).ConfigureAwait(false);
                if (id.HasValue && id.Value > 0)
                {
                    await AppDataFileLog.WriteAsync("INFO", $"Claim job tài liệu #{id.Value}.").ConfigureAwait(false);
                    await _processor.ProcessAsync(id.Value, stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Pdf2Layer worker");
                await AppDataFileLog.WriteAsync("ERROR", "Worker loop exception.", ex).ConfigureAwait(false);
            }

            await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
        }
    }
}
