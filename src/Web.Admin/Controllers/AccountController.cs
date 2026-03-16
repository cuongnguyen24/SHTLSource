using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.Admin.Controllers;

public class AccountController : Controller
{
    private readonly IAuthAppService _authService;

    public AccountController(IAuthAppService authService)
    {
        _authService = authService;
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        ViewBag.ReturnUrl = returnUrl;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginRequest model, string? returnUrl)
    {
        if (!ModelState.IsValid) return View(model);

        var result = await _authService.LoginAsync(model, HttpContext);
        if (!result.Success)
        {
            ModelState.AddModelError("", result.Message ?? "Đăng nhập thất bại");
            return View(model);
        }

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Home");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _authService.LogoutAsync(HttpContext);
        return RedirectToAction(nameof(Login));
    }
}
