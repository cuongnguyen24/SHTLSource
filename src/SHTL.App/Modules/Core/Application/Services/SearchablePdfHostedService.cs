using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Options;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;

namespace SHTL.Modules.Core.Application.Services;

/// <summary>Worker nền: lấy tài liệu chờ PDF 2 lớp và chạy OCR/ghép lớp chữ.</summary>
public sealed class SearchablePdfHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptions<SearchablePdfOptions> _options;
    private readonly ILogger<SearchablePdfHostedService> _logger;

    public SearchablePdfHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<SearchablePdfOptions> options,
        ILogger<SearchablePdfHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken).ConfigureAwait(false);

        while (!stoppingToken.IsCancellationRequested)
        {
            var opt = _options.Value;
            var delay = TimeSpan.FromSeconds(Math.Clamp(opt.PollIntervalSeconds, 2, 120));

            if (!opt.Enabled)
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                continue;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IDocumentRepository>();
                var stale = TimeSpan.FromMinutes(Math.Clamp(opt.StaleProcessingMinutes, 5, 240));
                var reset = await repo.ResetStaleSearchablePdfProcessingAsync(stale).ConfigureAwait(false);
                if (reset > 0)
                    _logger.LogWarning("Searchable PDF: phục hồi {Count} job bị kẹt", reset);

                var id = await repo.TryClaimSearchablePdfJobAsync().ConfigureAwait(false);
                if (id.HasValue && id.Value > 0)
                {
                    var processor = scope.ServiceProvider.GetRequiredService<ISearchablePdfProcessor>();
                    await processor.ProcessAsync(id.Value, stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Searchable PDF worker");
            }

            await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
        }
    }
}
