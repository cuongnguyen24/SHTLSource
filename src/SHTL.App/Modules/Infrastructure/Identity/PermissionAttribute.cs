using SHTL.Modules.Core.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

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

    private static bool HasPermissionClaim(System.Security.Claims.ClaimsPrincipal user, ModuleCode m)
    {
        var name = m.ToString();
        var numeric = ((int)m).ToString(System.Globalization.CultureInfo.InvariantCulture);
        return user.HasClaim("permission", name) || user.HasClaim("permission", numeric);
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

        var isAdmin = user.IsInRole("admin");
        if (isAdmin) return;

        var hasAccess = _requireAll
            ? _modules.All(m => HasPermissionClaim(user, m))
            : _modules.Any(m => HasPermissionClaim(user, m));

        if (!hasAccess)
        {
            context.Result = new ForbidResult();
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
            context.Result = new ForbidResult();
        }
    }
}
