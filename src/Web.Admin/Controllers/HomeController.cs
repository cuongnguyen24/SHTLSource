using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Web.Shared;

namespace Web.Admin.Controllers;

public class HomeController : BaseAdminController
{
    private readonly IReportService _reportService;

    public HomeController(IReportService reportService)
    {
        _reportService = reportService;
    }

    public async Task<IActionResult> Index()
    {
        var progress = await _reportService.GetWorkflowProgressAsync(ChannelId);
        SetPageHeader("Tổng quan tiến độ", "chart-line",
            new BreadcrumbItem { Text = "Tổng quan" });
        return View(progress);
    }

    public IActionResult Privacy()
    {
        return View();
    }
}
