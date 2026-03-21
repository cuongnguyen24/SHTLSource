using System.Diagnostics;
using Core.Domain.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Web.Dashboard.Models;

namespace Web.Dashboard.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly DashboardModuleLinks _links;
    private readonly ICurrentUser _currentUser;
    private readonly ErrorHandlingOptions _errorHandling;

    public HomeController(
        ILogger<HomeController> logger,
        IOptions<DashboardModuleLinks> links,
        IOptions<ErrorHandlingOptions> errorHandling,
        ICurrentUser currentUser)
    {
        _logger = logger;
        _links = links.Value;
        _errorHandling = errorHandling.Value;
        _currentUser = currentUser;
    }

    [Authorize]
    public IActionResult Index()
    {
        return View(new DashboardIndexVm
        {
            Links = _links,
            User = _currentUser.Id != 0 ? _currentUser : null
        });
    }

    [Authorize]
    public IActionResult Privacy()
    {
        return View();
    }

    /// <summary>
    /// Demo giọng nói nằm trên Web.SoHoa. Trên Dashboard chỉ chuyển hướng tới module Số hóa (vd /sohoa/... hoặc URL đầy đủ trong cấu hình).
    /// </summary>
    [AllowAnonymous]
    public IActionResult SpeechDemo()
    {
        var url = DashboardModuleLinks.Join(_links.SoHoaUrl, "/home/speechdemo");
        return Redirect(url);
    }

    [AllowAnonymous]
    public IActionResult StatusCode(int? code)
    {
        var statusCode = code ?? 404;
        Response.StatusCode = statusCode;
        return statusCode switch
        {
            404 => View("NotFound"),
            >= 500 => View("ServerError", new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
            }),
            _ => View("StatusCode", statusCode)
        };
    }

    [AllowAnonymous]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        var model = new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier };
        return _errorHandling.UseCustomErrorPages
            ? View("ServerError", model)
            : View(model);
    }
}
