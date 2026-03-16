using Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

/// <summary>
/// Application-level auth service: wraps IAuthService and handles cookie sign-in/out.
/// Used by web controllers (not API).
/// </summary>
public interface IAuthAppService
{
    Task<ApiResult> LoginAsync(LoginRequest req, HttpContext ctx);
    Task LogoutAsync(HttpContext ctx);
}

public class AuthAppService : IAuthAppService
{
    private readonly IAuthService _authService;

    public AuthAppService(IAuthService authService)
    {
        _authService = authService;
    }

    public async Task<ApiResult> LoginAsync(LoginRequest req, HttpContext ctx)
    {
        var (success, message, principal) = await _authService.LoginAsync(req.UserName, req.Password, req.ChannelId);
        if (!success || principal is null)
            return ApiResult.Fail(message);

        var props = new AuthenticationProperties
        {
            IsPersistent = req.RememberMe,
            ExpiresUtc = req.RememberMe
                ? DateTimeOffset.UtcNow.AddDays(30)
                : DateTimeOffset.UtcNow.AddHours(8)
        };

        await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, props);
        return ApiResult.Ok(message);
    }

    public async Task LogoutAsync(HttpContext ctx)
    {
        await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
