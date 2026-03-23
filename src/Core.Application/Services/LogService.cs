using Infrastructure.Data.Repositories.Log;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface ILogService
{
    Task<PaginatedResult<ActionLogDto>> GetActionLogsAsync(int channelId, int pageIndex, int pageSize, string? date, string? search);
    Task<PaginatedResult<AccessLogDto>> GetAccessLogsAsync(int channelId, int pageIndex, int pageSize, string? dateFrom, string? dateTo, string? search, bool loginOnly = false);
}

public class LogService : ILogService
{
    private readonly ILogRepository _logRepo;

    public LogService(ILogRepository logRepo)
    {
        _logRepo = logRepo;
    }

    public async Task<PaginatedResult<ActionLogDto>> GetActionLogsAsync(int channelId, int pageIndex, int pageSize, string? date, string? search)
    {
        var items = await _logRepo.GetActionLogsAsync(channelId, pageIndex, pageSize, date, search);
        var count = await _logRepo.CountActionLogsAsync(channelId, date, search);
        return new PaginatedResult<ActionLogDto>
        {
            Items = items,
            TotalCount = count,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    public async Task<PaginatedResult<AccessLogDto>> GetAccessLogsAsync(int channelId, int pageIndex, int pageSize, string? dateFrom, string? dateTo, string? search, bool loginOnly = false)
    {
        var items = await _logRepo.GetAccessLogsAsync(channelId, pageIndex, pageSize, dateFrom, dateTo, search, loginOnly);
        var count = await _logRepo.CountAccessLogsAsync(channelId, dateFrom, dateTo, search, loginOnly);
        return new PaginatedResult<AccessLogDto>
        {
            Items = items,
            TotalCount = count,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }
}
