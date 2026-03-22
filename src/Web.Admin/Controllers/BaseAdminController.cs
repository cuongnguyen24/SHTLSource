using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Shared.Contracts;
using Web.Shared;

namespace Web.Admin.Controllers;

public abstract class BaseAdminController : Controller
{
    protected ICurrentUser CurrentUser { get; private set; } = null!;
    protected int ChannelId => CurrentUser.ChannelId;

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

        if (!currentUser.IsAdmin)
        {
            context.Result = Forbid();
            return;
        }

        CurrentUser = currentUser;
        ViewBag.CurrentUser = CurrentUser;
        await next();
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
