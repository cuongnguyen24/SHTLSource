using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.Admin.Controllers;

public class ConfigController : BaseAdminController
{
    private readonly IConfigService _configService;

    public ConfigController(IConfigService configService)
    {
        _configService = configService;
    }

    // ---- System Config ----
    public async Task<IActionResult> Index()
    {
        var configs = await _configService.GetSystemConfigsAsync();
        SetPageHeader("Cấu hình thông số", "sliders-h",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Cấu hình thông số" });
        return View(configs);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveConfig(SaveConfigRequest model)
    {
        var result = await _configService.SaveConfigAsync(model, CurrentUser);
        return JsonResult(result);
    }

    // ---- Content Type ----
    public async Task<IActionResult> ContentType()
    {
        var list = await _configService.GetContentTypesAsync();
        return View(list);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveContentType(ContentTypeRequest model)
    {
        var result = await _configService.SaveContentTypeAsync(model, CurrentUser);
        return JsonResult(result);
    }

    // ---- Record Type ----
    public async Task<IActionResult> RecordType()
    {
        var list = await _configService.GetRecordTypesAsync();
        return View(list);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveRecordType(RecordTypeRequest model)
    {
        var result = await _configService.SaveRecordTypeAsync(model, CurrentUser);
        return JsonResult(result);
    }

    // ---- Sync Type ----
    public async Task<IActionResult> SyncType()
    {
        var list = await _configService.GetSyncTypesAsync();
        return View(list);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveSyncType(SyncTypeRequest model)
    {
        var result = await _configService.SaveSyncTypeAsync(model, CurrentUser);
        return JsonResult(result);
    }

    // ---- Export Type ----
    public async Task<IActionResult> ExportType()
    {
        var list = await _configService.GetExportTypesAsync();
        return View(list);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveExportType(ExportTypeRequest model)
    {
        var result = await _configService.SaveExportTypeAsync(model, CurrentUser);
        return JsonResult(result);
    }
}
