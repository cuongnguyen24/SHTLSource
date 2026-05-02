using SHTL.Modules.Infrastructure.Data.Repositories.Log;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface ILogService
{
    Task<PaginatedResult<ActionLogDto>> GetActionLogsAsync(int pageIndex, int pageSize, string? date, string? search);
    Task<PaginatedResult<AccessLogDto>> GetAccessLogsAsync(int pageIndex, int pageSize, string? dateFrom, string? dateTo, string? search, bool loginOnly = false);
}

public class LogService : ILogService
{
    private readonly ILogRepository _logRepo;

    public LogService(ILogRepository logRepo)
    {
        _logRepo = logRepo;
    }

    public async Task<PaginatedResult<ActionLogDto>> GetActionLogsAsync(int pageIndex, int pageSize, string? date, string? search)
    {
        var items = await _logRepo.GetActionLogsAsync(pageIndex, pageSize, date, search);
        var count = await _logRepo.CountActionLogsAsync(date, search);
        return new PaginatedResult<ActionLogDto>
        {
            Items = items,
            TotalCount = count,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    public async Task<PaginatedResult<AccessLogDto>> GetAccessLogsAsync(int pageIndex, int pageSize, string? dateFrom, string? dateTo, string? search, bool loginOnly = false)
    {
        var items = await _logRepo.GetAccessLogsAsync(pageIndex, pageSize, dateFrom, dateTo, search, loginOnly);
        var count = await _logRepo.CountAccessLogsAsync(dateFrom, dateTo, search, loginOnly);
        return new PaginatedResult<AccessLogDto>
        {
            Items = items,
            TotalCount = count,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }
}
