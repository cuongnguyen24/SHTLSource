using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SHTL.Modules.Core.Domain.Enums;
using System.Security.Claims;

namespace SHTL.Modules.Infrastructure.Identity;

/// <summary>
/// Kiểm tra người dùng có quyền truy cập module cụ thể.
/// Dùng: [AuthorizeModule(ModuleCode.CheckFirst)]
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class AuthorizeModuleAttribute : Attribute, IAuthorizationFilter
{
    private readonly ModuleCode[] _modules;
    private readonly bool _requireAll;

    public AuthorizeModuleAttribute(params ModuleCode[] modules)
    {
        _modules = modules;
        _requireAll = false;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            var req = context.HttpContext.Request;
            var returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
            context.Result = new RedirectToActionResult(
                "Login", "Account",
                new { area = "account", returnUrl });
            return;
        }

        if (user.IsInRole("admin"))
            return;

        var hasAccess = _requireAll
            ? _modules.All(m => ModuleAuthorization.HasModule(user, m))
            : ModuleAuthorization.HasAnyModule(user, _modules);

        if (!hasAccess)
        {
            context.Result = new RedirectToActionResult(
                "AccessDenied", "Home", new { area = "dashboard" });
        }
    }
}

/// <summary>Dùng cho các trang chỉ admin mới vào được</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AuthorizeAdminAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            var req = context.HttpContext.Request;
            var returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
            context.Result = new RedirectToActionResult(
                "Login", "Account",
                new { area = "account", returnUrl });
            return;
        }
        if (!user.IsInRole("admin"))
        {
            var req = context.HttpContext.Request;
            var returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
            var area = (context.RouteData.Values["area"] as string ?? string.Empty);
            var targetArea = string.Equals(area, "admin", StringComparison.OrdinalIgnoreCase)
                ? "admin"
                : "dashboard";
            context.Result = new RedirectToActionResult(
                "AccessDenied", "Home", new { area = targetArea, returnUrl });
        }
    }
}
