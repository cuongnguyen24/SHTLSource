using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Shared.Contracts;

namespace Web.Admin.Controllers;

public abstract class BaseAdminController : Controller
{
    protected ICurrentUser CurrentUser { get; private set; } = null!;
    protected int ChannelId => CurrentUser.ChannelId;

    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // Resolve ICurrentUser from request services (registered as scoped per request)
        var currentUser = context.HttpContext.RequestServices
            .GetService(typeof(ICurrentUser)) as ICurrentUser;

        if (currentUser == null || currentUser.Id == 0)
        {
            context.Result = RedirectToAction("Login", "Account");
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
