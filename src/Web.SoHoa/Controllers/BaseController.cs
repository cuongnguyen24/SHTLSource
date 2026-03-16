using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts;

namespace Web.SoHoa.Controllers;

/// <summary>
/// BaseController chung cho Web.SoHoa.
/// Cung cấp: current user, paging, message helper, permission check.
/// </summary>
public abstract class BaseController : Controller
{
    protected ICurrentUser CurrentUser => HttpContext.RequestServices
        .GetRequiredService<ICurrentUser>();

    protected int ChannelId => CurrentUser.ChannelId;

    protected PageRequest GetPageRequest(int pageSize = 20)
    {
        var page = int.TryParse(Request.Query["page"], out var p) ? p : 1;
        var size = int.TryParse(Request.Query["size"], out var s) ? s : pageSize;
        return new PageRequest { PageIndex = Math.Max(1, page), PageSize = Math.Min(200, size) };
    }

    protected void SetSuccess(string message) => TempData["Success"] = message;
    protected void SetError(string message) => TempData["Error"] = message;
    protected void SetWarning(string message) => TempData["Warning"] = message;
    protected void SetInfo(string message) => TempData["Info"] = message;

    protected IActionResult JsonOk(string? message = null)
        => Json(new { success = true, message });

    protected IActionResult JsonFail(string message)
        => Json(new { success = false, message });

    protected IActionResult JsonResult<T>(ApiResult<T> result)
        => Json(new { result.Success, result.Message, result.Data, result.Errors });

    protected IActionResult JsonResult(ApiResult result)
        => Json(new { result.Success, result.Message, result.Errors });

    protected IActionResult RedirectWithError(string url, string error)
    {
        SetError(error);
        return Redirect(url);
    }
}
