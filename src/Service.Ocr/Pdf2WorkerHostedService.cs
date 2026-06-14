using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Ocr;

internal sealed class OcrWorkerHostedService : BackgroundService
{
    private readonly OcrServiceJobRepository _repo;
    private readonly OcrProcessor _processor;
    private readonly PythonDependencyBootstrapper _bootstrapper;
    private readonly IOptions<OcrSearchablePdfWorkerOptions> _options;
    private readonly ILogger<OcrWorkerHostedService> _logger;

    public OcrWorkerHostedService(
        OcrServiceJobRepository repo,
        OcrProcessor processor,
        PythonDependencyBootstrapper bootstrapper,
        IOptions<OcrSearchablePdfWorkerOptions> options,
        ILogger<OcrWorkerHostedService> logger)
    {
        _repo = repo;
        _processor = processor;
        _bootstrapper = bootstrapper;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var logRoots = AppDataFileLog.GetLogRootCandidates();
        _logger.LogInformation(
            "OcrService khởi động. File log (ưu tiên): {Paths}",
            string.Join(" | ", logRoots));
        await AppDataFileLog.WriteAsync(
            "INFO",
            $"OcrService service started. Ghi log theo ngày tại: {string.Join(" | ", logRoots)} (thư mục yyyy/MM, file OcrService-yyyyMMdd.log). " +
            $"Nếu không ghi được, fallback: {Path.Combine(Path.GetTempPath(), "SHTL", "OcrService", "AppData")}.")
            .ConfigureAwait(false);
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken).ConfigureAwait(false);

        var ready = await _bootstrapper.EnsureReadyAsync(stoppingToken).ConfigureAwait(false);
        if (!ready)
        {
            _logger.LogError("OcrService: Python dependency chưa sẵn sàng, worker tạm ngưng vòng xử lý.");
            await AppDataFileLog.WriteAsync("ERROR", "Python dependency chưa sẵn sàng khi service khởi động.").ConfigureAwait(false);
        }

        // Danh sách các task đang chạy song song
        var activeTasks = new List<Task>();
        var lastStaleReset = DateTime.MinValue;
        var lastResourceLog = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            var opt = _options.Value;
            var pollDelay = TimeSpan.FromSeconds(Math.Clamp(opt.PollIntervalSeconds, 2, 120));

            if (!opt.Enabled)
            {
                await SafeDelayAsync(pollDelay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            if (!ready)
            {
                ready = await _bootstrapper.EnsureReadyAsync(stoppingToken).ConfigureAwait(false);
                if (!ready)
                    await AppDataFileLog.WriteAsync("WARN", "Worker retry dependency: chưa sẵn sàng.").ConfigureAwait(false);
                await SafeDelayAsync(pollDelay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            // Dọn task đã hoàn thành để list không phình to
            activeTasks.RemoveAll(t => t.IsCompleted);
            var activeCount = activeTasks.Count;

            try
            {
                // ── Stale reset ──────────────────────────────────────────────
                // Chỉ chạy khi không có job đang chạy (tránh reset nhầm job đang xử lý lâu),
                // và tối thiểu 5 phút/lần.
                if (activeCount == 0 && DateTime.UtcNow - lastStaleReset > TimeSpan.FromMinutes(5))
                {
                    var staleWindow = TimeSpan.FromMinutes(Math.Clamp(opt.StaleProcessingMinutes, 5, 240));
                    var reset = await _repo.ResetStaleOcrSearchablePdfProcessingAsync(staleWindow, stoppingToken).ConfigureAwait(false);
                    if (reset > 0)
                    {
                        _logger.LogWarning("OcrService: phục hồi {Count} job bị kẹt (stale processing)", reset);
                        await AppDataFileLog.WriteAsync("WARN", $"Phục hồi {reset} job bị kẹt.").ConfigureAwait(false);
                    }
                    lastStaleReset = DateTime.UtcNow;
                }

                // ── Dynamic concurrency ──────────────────────────────────────
                var target = Math.Min(5, SystemResourceMonitor.ComputeTargetWorkers(opt));

                // Log resource status định kỳ (1 phút/lần)
                if (DateTime.UtcNow - lastResourceLog > TimeSpan.FromMinutes(1))
                {
                    var freeMem = SystemResourceMonitor.GetAvailableMemoryMb();
                    _logger.LogInformation(
                        "OcrService: workers={Active}/{Target} | freeMemory={FreeMem}MB | cpuCores={Cores}",
                        activeCount, target, freeMem, SystemResourceMonitor.ProcessorCount);
                    lastResourceLog = DateTime.UtcNow;
                }

                // ── Claim thêm job cho đến khi đủ target hoặc hết queue ─────
                while (activeTasks.Count(t => !t.IsCompleted) < target
                       && !stoppingToken.IsCancellationRequested)
                {
                    var id = await _repo.TryClaimOcrSearchablePdfJobAsync(target, stoppingToken).ConfigureAwait(false);
                    if (!id.HasValue || id.Value <= 0)
                        break; // Không còn job nào trong queue

                    var jobId = id.Value;
                    var currentActive = activeTasks.Count(t => !t.IsCompleted) + 1;
                    await AppDataFileLog.WriteAsync(
                        "INFO",
                        $"Claim job #{jobId}. workers={currentActive}/{target}").ConfigureAwait(false);

                    // Chạy job trên thread pool, bọc exception để task không bao giờ faulted
                    var task = RunJobSafeAsync(jobId, stoppingToken);
                    activeTasks.Add(task);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OcrService worker loop exception");
                await AppDataFileLog.WriteAsync("ERROR", "Worker loop exception.", ex).ConfigureAwait(false);
            }

            // ── Chờ: poll interval HOẶC đến khi có task hoàn thành ──────────
            // Khi có job đang chạy, wake up ngay khi bất kỳ task nào xong để claim job mới nhanh nhất.
            var running = activeTasks.Where(t => !t.IsCompleted).ToList();
            if (running.Count > 0)
            {
                try
                {
                    await Task.WhenAny(
                        Task.Delay(pollDelay, stoppingToken),
                        Task.WhenAny(running)
                    ).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
            else
            {
                await SafeDelayAsync(pollDelay, stoppingToken).ConfigureAwait(false);
            }
        }

        // ── Graceful shutdown: chờ các task đang chạy hoàn thành ────────────
        var stillRunning = activeTasks.Where(t => !t.IsCompleted).ToList();
        if (stillRunning.Count > 0)
        {
            _logger.LogInformation("OcrService: đợi {Count} job đang chạy hoàn tất trước khi tắt...", stillRunning.Count);
            await AppDataFileLog.WriteAsync("INFO", $"Graceful shutdown: đợi {stillRunning.Count} job hoàn tất.").ConfigureAwait(false);
            try
            {
                await Task.WhenAll(stillRunning).ConfigureAwait(false);
            }
            catch
            {
                // RunJobSafeAsync không throw, bỏ qua
            }
        }

        await AppDataFileLog.WriteAsync("INFO", "OcrService service stopped.").ConfigureAwait(false);
    }

    /// <summary>
    /// Chạy một job an toàn trong Task riêng.
    /// Không bao giờ throw — mọi exception đã được xử lý bên trong.
    /// </summary>
    private async Task RunJobSafeAsync(long jobId, CancellationToken stoppingToken)
    {
        try
        {
            await _processor.ProcessAsync(jobId, stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Service đang dừng — job ở trạng thái Processing (11),
            // stale-reset khi khởi động lại sẽ đưa về Queued (10).
            _logger.LogInformation("OcrService: job #{JobId} bị hủy do service dừng", jobId);
            await AppDataFileLog.WriteAsync(
                "INFO",
                $"Job #{jobId} bị hủy do service dừng — sẽ phục hồi tự động khi khởi động lại.").ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // ProcessAsync đã xử lý lỗi và update status 13 bên trong.
            // Đây chỉ là lớp an toàn bổ sung.
            _logger.LogError(ex, "OcrService: lỗi không mong đợi trong job #{JobId}", jobId);
            await AppDataFileLog.WriteAsync("ERROR", $"Lỗi không mong đợi trong job #{jobId}", ex).ConfigureAwait(false);
        }
    }

    private async Task SafeDelayAsync(TimeSpan delay, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Bình thường khi service dừng
        }
    }
}
