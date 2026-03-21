using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Web.Account.Logging;
using Web.Account.Models;

namespace Web.Account.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly ErrorHandlingOptions _errorHandling;
    private readonly IWebHostEnvironment _env;

    public HomeController(
        ILogger<HomeController> logger,
        IOptions<ErrorHandlingOptions> errorHandling,
        IWebHostEnvironment env)
    {
        _logger = logger;
        _errorHandling = errorHandling.Value;
        _env = env;
    }

    [Authorize]
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
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
        var feature = HttpContext.Features.Get<IExceptionHandlerFeature>();
        if (feature?.Error != null)
            AppDataErrorLogger.WriteException(_env, feature.Error, "Home/Error (unhandled)");

        var model = new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier };
        return _errorHandling.UseCustomErrorPages
            ? View("ServerError", model)
            : View(model);
    }
}
