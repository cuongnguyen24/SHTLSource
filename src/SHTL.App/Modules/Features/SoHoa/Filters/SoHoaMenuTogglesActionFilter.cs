using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;

namespace SHTL.Modules.Features.SoHoa.Filters;

/// <summary>
/// Nạp cờ <c>IsCheckFirstScan</c>, <c>IsCheckSecondScan</c>, <c>IsCheck1</c>, <c>IsCheck2</c> vào ViewBag cho mọi action area sohoa.
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
            c.ViewBag.ShowCheckFirstScan = SohoWorkflowUiToggles.IsFeatureEnabled(map, "IsCheckFirstScan");
            c.ViewBag.ShowCheckSecondScan = SohoWorkflowUiToggles.IsFeatureEnabled(map, "IsCheckSecondScan");
            c.ViewBag.ShowCheck1 = SohoWorkflowUiToggles.IsFeatureEnabled(map, "IsCheck1");
            c.ViewBag.ShowCheck2 = SohoWorkflowUiToggles.IsFeatureEnabled(map, "IsCheck2");
        }

        await next();
    }
}
