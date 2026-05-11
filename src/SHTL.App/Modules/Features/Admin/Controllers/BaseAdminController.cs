using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Shared.Contracts;

namespace SHTL.Modules.Features.Admin.Controllers;

public abstract class BaseAdminController : Controller
{
    protected ICurrentUser CurrentUser { get; private set; } = null!;

    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var currentUser = context.HttpContext.RequestServices
            .GetService(typeof(ICurrentUser)) as ICurrentUser;

        if (currentUser == null || currentUser.Id == 0)
        {
            var shell = context.HttpContext.RequestServices.GetRequiredService<IOptions<ShellOptions>>().Value;
            var loginUrl = string.IsNullOrWhiteSpace(shell.ExternalLoginUrl)
                ? "/account/Account/Login"
                : shell.ExternalLoginUrl.TrimEnd('/');
            var req = context.HttpContext.Request;
            string returnUrl;
            if (loginUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || loginUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                returnUrl = $"{req.Scheme}://{req.Host}{req.PathBase}{req.Path}{req.QueryString}";
            }
            else
            {
                returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
            }

            var sep = loginUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
            context.Result = new RedirectResult($"{loginUrl}{sep}returnUrl={Uri.EscapeDataString(returnUrl)}");
            return;
        }

        // Cho phép user thường truy cập trang AccessDenied (Home/AccessDenied) để hiển thị
        // thông báo thân thiện thay vì màn hình 403 trống.
        var actionName = (context.RouteData.Values["action"] as string ?? string.Empty);
        var controllerName = (context.RouteData.Values["controller"] as string ?? string.Empty);
        var isAccessDeniedPage = string.Equals(controllerName, "Home", StringComparison.OrdinalIgnoreCase)
            && string.Equals(actionName, "AccessDenied", StringComparison.OrdinalIgnoreCase);

        if (!currentUser.IsAdmin && !isAccessDeniedPage)
        {
            var req = context.HttpContext.Request;
            var returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
            context.Result = new RedirectToActionResult(
                "AccessDenied", "Home",
                new { area = "admin", returnUrl });
            return;
        }

        CurrentUser = currentUser;
        ViewBag.CurrentUser = CurrentUser;
        await next();
    }

    /// <summary>Breadcrumb + tiêu đề trang cho partial _ShtlPageHeader.</summary>
    protected void SetPageHeader(string title, string fontAwesomeIcon, params BreadcrumbItem[] crumbs)
    {
        ViewData["Title"] = title;
        ViewData["PageTitle"] = title;
        ViewData["PageIcon"] = fontAwesomeIcon;
        ViewData["Breadcrumbs"] = crumbs.Length > 0
            ? crumbs.ToList()
            : new List<BreadcrumbItem> { new() { Text = "Tổng quan", Url = Url.Action("Index", "Home") } };
    }

    protected (int PageIndex, int PageSize, string Search) GetPageRequest()
    {
        int.TryParse(Request.Query["page"], out var page);
        int.TryParse(Request.Query["size"], out var size);
        var search = Request.Query["q"].ToString().Trim();
        return (page > 0 ? page : 1, size > 0 ? size : 20, search);
    }

    protected void SetSuccess(string msg) => TempData["Success"] = msg;
    protected void SetError(string msg) => TempData["Error"] = msg;

    protected IActionResult JsonResult(ApiResult result)
        => Json(new { success = result.Success, message = result.Message });
}
