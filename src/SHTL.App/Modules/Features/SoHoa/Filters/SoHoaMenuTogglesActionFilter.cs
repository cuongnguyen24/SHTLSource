using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;

namespace SHTL.Modules.Features.SoHoa.Filters;

/// <summary>
/// Nạp cờ <c>IsCheckFirstScan</c>, <c>IsCheckSecondScan</c>, <c>IsCheck1</c>, <c>IsCheck2</c> vào ViewBag cho mọi action area sohoa.
/// Kết hợp cấu hình hệ thống (toggle) VÀ vai trò của người dùng.
/// </summary>
public sealed class SoHoaMenuTogglesActionFilter : IAsyncActionFilter
{
    private readonly ICnfRepository _cnf;

    public SoHoaMenuTogglesActionFilter(ICnfRepository cnf) => _cnf = cnf;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!string.Equals(context.RouteData.Values["area"] as string, "sohoa", StringComparison.OrdinalIgnoreCase))
        {
            await next();
            return;
        }

        var configs = await _cnf.GetConfigsAsync();
        var map = configs.ToDictionary(x => x.Key ?? string.Empty, x => x.Value, StringComparer.OrdinalIgnoreCase);

        if (context.Controller is Controller c)
        {
            var user = context.HttpContext.User;
            var isAdmin = user.IsInRole("admin");

            bool CanAccess(string configKey, string roleCode)
            {
                if (!SohoWorkflowUiToggles.IsFeatureEnabled(map, configKey)) return false;
                return isAdmin || user.IsInRole(roleCode);
            }

            c.ViewBag.ShowCheckFirstScan = CanAccess("IsCheckFirstScan", "CHECK_SCAN_1");
            c.ViewBag.ShowCheckSecondScan = CanAccess("IsCheckSecondScan", "CHECK_SCAN_2");
            c.ViewBag.ShowCheck1 = CanAccess("IsCheck1", "CHECK_EXTRACT_1");
            c.ViewBag.ShowCheck2 = CanAccess("IsCheck2", "CHECK_EXTRACT_2");
        }

        await next();
    }
}
