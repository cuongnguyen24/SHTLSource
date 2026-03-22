using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;

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
        return View(progress);
    }

    public IActionResult Privacy()
    {
        return View();
    }
}
