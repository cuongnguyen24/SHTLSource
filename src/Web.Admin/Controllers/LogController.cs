using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Web.Admin.Controllers;

public class LogController : BaseAdminController
{
    private readonly ILogService _logService;

    public LogController(ILogService logService)
    {
        _logService = logService;
    }

    public async Task<IActionResult> Action()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var list = await _logService.GetActionLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, req.Search);
        ViewBag.Date = date;
        ViewBag.Search = req.Search;
        return View(list);
    }

    public async Task<IActionResult> Access()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var list = await _logService.GetAccessLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, req.Search);
        ViewBag.Date = date;
        ViewBag.Search = req.Search;
        return View(list);
    }
}
