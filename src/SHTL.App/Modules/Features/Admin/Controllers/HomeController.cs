using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Features.Shared;

namespace SHTL.Modules.Features.Admin.Controllers;

public class HomeController : BaseAdminController
{
    private readonly IReportService _reportService;

    public HomeController(IReportService reportService)
    {
        _reportService = reportService;
    }

    public async Task<IActionResult> Index()
    {
        var progress = await _reportService.GetWorkflowProgressAsync();
        SetPageHeader("Tổng quan tiến độ", "chart-line",
            new BreadcrumbItem { Text = "Tổng quan" });
        return View(progress);
    }

    public IActionResult Privacy()
    {
        return View();
    }

    /// <summary>Trang thông báo "không có quyền" cho khu vực admin. Cho phép mọi user (kể cả không phải admin) xem.</summary>
    [AllowAnonymous]
    public IActionResult AccessDenied(string? returnUrl = null)
    {
        Response.StatusCode = 403;
        ViewData["ReturnUrl"] = returnUrl;
        return View();
    }
}
