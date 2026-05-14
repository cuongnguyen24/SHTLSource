using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Identity;

namespace SHTL.Modules.Features.SoHoa.Filters;

/// <summary>
/// Nạp cờ cấu hình workflow và quyền module vào ViewBag cho mọi action area sohoa.
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

            bool CanAccessModule(params ModuleCode[] modules)
                => ModuleAuthorization.HasAnyModule(user, modules);

            bool CanAccessToggle(string configKey, params ModuleCode[] modules)
            {
                if (!SohoWorkflowUiToggles.IsFeatureEnabled(map, configKey))
                    return false;
                return CanAccessModule(modules);
            }

            c.ViewBag.ShowScanUpload = CanAccessModule(ModuleCode.ScanUpload);
            c.ViewBag.ShowSyncUpload = CanAccessModule(ModuleCode.ScanUpload);
            c.ViewBag.ShowExtract = CanAccessModule(
                ModuleCode.ExtractDigit,
                ModuleCode.ExtractAlphabet,
                ModuleCode.ExtractCharacter,
                ModuleCode.ExtractTick,
                ModuleCode.ExtractForm);
            c.ViewBag.ShowCheckFirstScan = CanAccessToggle("IsCheckFirstScan", ModuleCode.CheckScanFirst);
            c.ViewBag.ShowCheckSecondScan = CanAccessToggle("IsCheckSecondScan", ModuleCode.CheckScanSecond);
            c.ViewBag.ShowCheck1 = CanAccessToggle("IsCheck1", ModuleCode.CheckFirst);
            c.ViewBag.ShowCheck2 = CanAccessToggle("IsCheck2", ModuleCode.CheckSecond);
            c.ViewBag.ShowExport = CanAccessModule(ModuleCode.ExportData);
            c.ViewBag.ShowExportConfig = CanAccessModule(ModuleCode.ExportConfig);
            c.ViewBag.ShowLoaiTaiLieu = CanAccessModule(ModuleCode.DocTypeConfig);
            c.ViewBag.ShowLoaiDongBo = CanAccessModule(ModuleCode.SyncTypeConfig);
            c.ViewBag.ShowReport = CanAccessModule(
                ModuleCode.Report,
                ModuleCode.ReportProductivity,
                ModuleCode.ReportQuality,
                ModuleCode.ReportLog);
        }

        await next();
    }
}
