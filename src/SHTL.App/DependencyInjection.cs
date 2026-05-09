using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SHTL.Modules.Core.Application;
using SHTL.Modules.Features.Account.Models;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Features.SoHoa.Filters;
using SHTL.Modules.Infrastructure.Data;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Infrastructure.Search;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Routing;

namespace SHTL;

public static class DependencyInjection
{
    public static IServiceCollection AddShtlMonolith(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.Configure<AccountAuthOptions>(configuration.GetSection(AccountAuthOptions.SectionName));
        services.Configure<SHTL.Modules.Features.Account.Models.ErrorHandlingOptions>(
            configuration.GetSection(SHTL.Modules.Features.Account.Models.ErrorHandlingOptions.SectionName));
        services.Configure<SHTL.Modules.Features.Dashboard.Models.ErrorHandlingOptions>(
            configuration.GetSection(SHTL.Modules.Features.Dashboard.Models.ErrorHandlingOptions.SectionName));

        services.AddScoped<SoHoaMenuTogglesActionFilter>();
        services.Configure<MvcOptions>(o =>
        {
            o.Conventions.Add(new FeatureModuleAreaConvention());
            o.Filters.AddService<SoHoaMenuTogglesActionFilter>();
        });
        services.Configure<RazorViewEngineOptions>(o =>
        {
            o.ViewLocationExpanders.Insert(0, new ModuleFeatureViewLocationExpander());
        });

        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        var signingKey = jwt.SigningKey;
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            signingKey = "DEV_ONLY_CHANGE_ME_32_CHARS_MIN______";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = string.IsNullOrWhiteSpace(jwt.Issuer) ? "SHTL" : jwt.Issuer,
                    ValidAudience = string.IsNullOrWhiteSpace(jwt.Audience) ? "SHTL.App" : jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                    ClockSkew = TimeSpan.FromMinutes(2),
                    NameClaimType = ClaimTypes.Name,
                    RoleClaimType = ClaimTypes.Role
                };
                var jwtHandler = new JwtSecurityTokenHandler();
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = ctx =>
                    {
                        // Chỉ đưa token vào pipeline khi đọc được JWT; cookie lỗi/placeholder tránh làm JwtBearer ném exception → 500 (Login [AllowAnonymous]).
                        if (!string.IsNullOrEmpty(ctx.Token))
                            return Task.CompletedTask;
                        if (!ctx.Request.Cookies.TryGetValue("access_token", out var t)
                            || string.IsNullOrWhiteSpace(t))
                            return Task.CompletedTask;
                        if (jwtHandler.CanReadToken(t))
                            ctx.Token = t;
                        else
                            ctx.Response.Cookies.Delete("access_token", new CookieOptions { Path = "/" });
                        return Task.CompletedTask;
                    },
                    OnAuthenticationFailed = ctx =>
                    {
                        ctx.NoResult();
                        return Task.CompletedTask;
                    },
                    OnChallenge = ctx =>
                    {
                        // MVC: trình duyệt cần redirect đăng nhập; JWT Bearer mặc định trả 401 (Chrome "This page isn't working").
                        ctx.HandleResponse();
                        var req = ctx.Request;
                        var accept = req.Headers.Accept.ToString();
                        var getOrHead = HttpMethods.IsGet(req.Method) || HttpMethods.IsHead(req.Method);
                        var likelyBrowser = accept.Contains("text/html", StringComparison.OrdinalIgnoreCase)
                            || (getOrHead && accept.Contains("*/*", StringComparison.OrdinalIgnoreCase))
                            || (getOrHead && string.IsNullOrWhiteSpace(accept));

                        if (likelyBrowser)
                        {
                            var shell = ctx.HttpContext.RequestServices.GetService<IOptions<ShellOptions>>();
                            var loginPath = shell?.Value.ExternalLoginUrl?.Trim();
                            if (string.IsNullOrEmpty(loginPath))
                                loginPath = "/account/Account/Login";
                            if (!loginPath.StartsWith('/'))
                                loginPath = "/" + loginPath;
                            var returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
                            var sep = loginPath.Contains('?', StringComparison.Ordinal) ? '&' : '?';
                            ctx.Response.Redirect(
                                $"{loginPath}{sep}returnUrl={Uri.EscapeDataString(returnUrl)}");
                            return Task.CompletedTask;
                        }

                        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();

        services.AddInfrastructureData(configuration);
        services.AddInfrastructureIdentity();
        services.AddShtlAccessLogging(configuration);
        services.AddInfrastructureStorage(configuration);
        services.AddInfrastructureSearch(configuration);
        services.AddCoreApplication(configuration);

        // ExportWorker depends on scoped repositories; register a scope-safe adapter when enabling the queue:
        // services.AddHostedService<ExportWorkerHostedService>();

        return services;
    }
}
