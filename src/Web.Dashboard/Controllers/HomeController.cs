using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Web.Dashboard.Models;
using Web.Shared;

namespace Web.Dashboard.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly ShellOptions _links;
    private readonly ErrorHandlingOptions _errorHandling;

    public HomeController(
        ILogger<HomeController> logger,
        IOptions<ShellOptions> links,
        IOptions<ErrorHandlingOptions> errorHandling)
    {
        _logger = logger;
        _links = links.Value;
        _errorHandling = errorHandling.Value;
    }

    [Authorize]
    public IActionResult Index()
    {
        return View(new DashboardIndexVm { Links = _links });
    }

    [Authorize]
    public IActionResult Privacy()
    {
        return View();
    }

    /// <summary>Demo giọng nói nằm trên Web.SoHoa.</summary>
    [AllowAnonymous]
    public IActionResult SpeechDemo()
    {
        var url = ShellOptions.Join(_links.SoHoaUrl, "/home/speechdemo");
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
