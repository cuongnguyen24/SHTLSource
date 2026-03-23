using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Web.Shared;

namespace Web.Admin.Controllers;

public class LogController : BaseAdminController
{
    private readonly ILogService _logService;

    public LogController(ILogService logService)
    {
        _logService = logService;
    }

    private void SetLogPage(string title, string icon)
    {
        SetPageHeader(title, icon,
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = title });
    }

    public async Task<IActionResult> Login()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var dateTo = Request.Query["to"].ToString();
        var list = await _logService.GetAccessLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, dateTo, req.Search, loginOnly: true);
        ViewBag.Date = date;
        ViewBag.DateTo = dateTo;
        ViewBag.Search = req.Search;
        SetLogPage("Log đăng nhập", "sign-in-alt");
        ViewData["SearchQuery"] = req.Search;
        ViewData["LogListHint"] = "Chỉ hiển thị các yêu cầu liên quan đăng nhập (đường dẫn chứa login, signin, account…).";
        return View("Access", list);
    }

    public async Task<IActionResult> Access()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var dateTo = Request.Query["to"].ToString();
        var list = await _logService.GetAccessLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, dateTo, req.Search, loginOnly: false);
        ViewBag.Date = date;
        ViewBag.DateTo = dateTo;
        ViewBag.Search = req.Search;
        SetLogPage("Log truy cập", "door-open");
        ViewData["SearchQuery"] = req.Search;
        ViewData["LogListHint"] = "Mọi yêu cầu HTTP được ghi nhận (trừ file tĩnh và một số đường dẫn hệ thống).";
        return View(list);
    }

    public async Task<IActionResult> Detail()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var list = await _logService.GetActionLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, req.Search);
        ViewBag.Date = date;
        ViewBag.Search = req.Search;
        SetLogPage("Log thay đổi nội dung", "file-alt");
        ViewData["SearchQuery"] = req.Search;
        return View("Action", list);
    }

    public async Task<IActionResult> Action()
    {
        var req = GetPageRequest();
        var date = Request.Query["date"].ToString();
        var list = await _logService.GetActionLogsAsync(ChannelId, req.PageIndex, req.PageSize, date, req.Search);
        ViewBag.Date = date;
        ViewBag.Search = req.Search;
        SetLogPage("Log thao tác", "history");
        ViewData["SearchQuery"] = req.Search;
        return View(list);
    }
}
