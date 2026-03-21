using Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Shared.Contracts.Dtos;
using Web.Account.Logging;
using Web.Account.Models;

namespace Web.Account.Controllers;

public class AccountController : Controller
{
    private readonly IAuthAppService _auth;
    private readonly IOptions<AccountAuthOptions> _authOptions;
    private readonly ILogger<AccountController> _logger;
    private readonly IWebHostEnvironment _env;

    public AccountController(
        IAuthAppService auth,
        IOptions<AccountAuthOptions> authOptions,
        ILogger<AccountController> logger,
        IWebHostEnvironment env)
    {
        _auth = auth;
        _authOptions = authOptions;
        _logger = logger;
        _env = env;
    }

    private bool IsAllowedReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl)) return false;
        if (Url.IsLocalUrl(returnUrl)) return true;
        foreach (var prefix in _authOptions.Value.AllowedReturnUrlPrefixes ?? Array.Empty<string>())
        {
            var p = prefix.TrimEnd('/');
            if (string.Equals(returnUrl, p, StringComparison.OrdinalIgnoreCase)) return true;
            if (returnUrl.StartsWith(p + "/", StringComparison.OrdinalIgnoreCase)) return true;
            if (returnUrl.StartsWith(p + "?", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Home");
        ViewBag.ReturnUrl = returnUrl;
        return View(new LoginRequest());
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginRequest model, string? returnUrl)
    {
        if (!ModelState.IsValid) return View(model);
        try
        {
            var result = await _auth.LoginAsync(model, HttpContext);
            if (!result.Success)
            {
                ModelState.AddModelError("", result.Message ?? "Đăng nhập thất bại");
                return View(model);
            }
            if (!string.IsNullOrEmpty(returnUrl) && IsAllowedReturnUrl(returnUrl))
                return Redirect(returnUrl);
            return RedirectToAction("Index", "Home");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi đăng nhập (thường là SQL Server hoặc thiếu config/connectionstrings.json).");
            AppDataErrorLogger.WriteException(_env, ex, "Account/Login");
            var msg = _env.IsDevelopment()
                ? ex.Message
                : "Không thể kết nối cơ sở dữ liệu. Xem chi tiết lỗi SQL trong thư mục app-data/logs (errors-YYYYMMDD.log) cạnh ứng dụng, và kiểm tra config/connectionstrings.json.";
            ModelState.AddModelError("", msg);
            return View(model);
        }
    }

    [AcceptVerbs("GET", "POST")]
    public async Task<IActionResult> Logout(string? returnUrl)
    {
        await _auth.LogoutAsync(HttpContext);
        if (!string.IsNullOrEmpty(returnUrl) && IsAllowedReturnUrl(returnUrl))
            return Redirect(returnUrl);
        return RedirectToAction(nameof(Login));
    }
}
