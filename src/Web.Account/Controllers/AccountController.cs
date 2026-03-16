using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.Account.Controllers;

public class AccountController : Controller
{
    private readonly IAuthAppService _auth;

    public AccountController(IAuthAppService auth)
    {
        _auth = auth;
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        ViewBag.ReturnUrl = returnUrl;
        return View(new LoginRequest());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginRequest model, string? returnUrl)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await _auth.LoginAsync(model, HttpContext);
        if (!result.Success)
        {
            ModelState.AddModelError("", result.Message ?? "Đăng nhập thất bại");
            return View(model);
        }
        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);
        return RedirectToAction("Index", "Profile");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _auth.LogoutAsync(HttpContext);
        return RedirectToAction(nameof(Login));
    }
}

