using Core.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Infrastructure.Identity;

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
        if (!user.Identity?.IsAuthenticated == true)
        {
            context.Result = new RedirectToActionResult("Login", "Account", null);
            return;
        }

        var isAdmin = user.IsInRole("admin");
        if (isAdmin) return;

        var hasAccess = _requireAll
            ? _modules.All(m => user.HasClaim("permission", m.ToString()))
            : _modules.Any(m => user.HasClaim("permission", m.ToString()));

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
        if (!user.Identity?.IsAuthenticated == true)
        {
            context.Result = new RedirectToActionResult("Login", "Account", null);
            return;
        }
        if (!user.IsInRole("admin"))
        {
            context.Result = new ForbidResult();
        }
    }
}
