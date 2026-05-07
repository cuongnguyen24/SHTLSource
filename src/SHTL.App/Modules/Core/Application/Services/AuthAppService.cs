using Microsoft.AspNetCore.Http;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

/// <summary>Application-level auth: issues JWT and stores it in an HTTP-only cookie for MVC requests.</summary>
public interface IAuthAppService
{
    Task<ApiResult> LoginAsync(LoginRequest req, HttpContext ctx);
    Task LogoutAsync(HttpContext ctx);
}

public class AuthAppService : IAuthAppService
{
    private const string AccessTokenCookie = "access_token";

    private readonly IAuthService _authService;
    private readonly IJwtTokenService _jwt;

    public AuthAppService(IAuthService authService, IJwtTokenService jwt)
    {
        _authService = authService;
        _jwt = jwt;
    }

    public async Task<ApiResult> LoginAsync(LoginRequest req, HttpContext ctx)
    {
        var (success, message, principal) = await _authService.LoginAsync(req.UserName, req.Password);
        if (!success || principal is null)
            return ApiResult.Fail(message);

        var token = _jwt.CreateAccessToken(principal.Claims);

        var cookieOpts = new CookieOptions
        {
            HttpOnly = true,
            Secure = ctx.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            IsEssential = true,
            Expires = req.RememberMe ? DateTimeOffset.UtcNow.AddDays(30) : DateTimeOffset.UtcNow.AddHours(8)
        };

        ctx.Response.Cookies.Append(AccessTokenCookie, token, cookieOpts);
        return ApiResult.Ok(message);
    }

    public Task LogoutAsync(HttpContext ctx)
    {
        ctx.Response.Cookies.Delete(AccessTokenCookie, new CookieOptions { Path = "/" });
        return Task.CompletedTask;
    }
}
