using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.Dashboard.Controllers;

/// <summary>
/// "Tiến độ thi công" trong khu vực dashboard.
/// Hiện tại đã tích hợp trang "Tiến độ thi công theo thư mục tài liệu" (trước đây ở /sohoa/report/folder-progress).
/// </summary>
[Authorize]
public class ConstructionController : Controller
{
    private readonly IFolderProgressReportService _folderProgress;
    private readonly IFolderDocumentsPurgeService _folderPurge;
    private readonly IFolderOcrRetryService _folderOcrRetry;
    private readonly IConstructionBatchService _batchService;
    private readonly IConstructionFolderBatchService _folderBatchService;
    private readonly IConstructionKpiPayrollService _kpiPayrollService;

    public ConstructionController(
        IFolderProgressReportService folderProgress,
        IFolderDocumentsPurgeService folderPurge,
        IFolderOcrRetryService folderOcrRetry,
        IConstructionBatchService batchService,
        IConstructionFolderBatchService folderBatchService,
        IConstructionKpiPayrollService kpiPayrollService)
    {
        _folderProgress = folderProgress;
        _folderPurge = folderPurge;
        _folderOcrRetry = folderOcrRetry;
        _batchService = batchService;
        _folderBatchService = folderBatchService;
        _kpiPayrollService = kpiPayrollService;
    }

    /// <summary>Trang tổng quan của khu vực "Tiến độ thi công" — liệt kê các báo cáo con.</summary>
    [HttpGet]
    [AuthorizeModule(
        ModuleCode.Report,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm,
        ModuleCode.CheckFirst,
        ModuleCode.CheckSecond,
        ModuleCode.CheckFinal,
        ModuleCode.CheckLogic)]
    public async Task<IActionResult> Index()
    {
        var vm = await _batchService.GetDashboardAsync();
        return View(vm);
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> Batches([FromQuery] string? folder = null, [FromQuery] string? q = null)
    {
        var vm = await _folderBatchService.GetFolderPageAsync(folder, q);
        return View("~/Modules/Features/Dashboard/Views/Construction/Batches.cshtml", vm);
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> DistributeFormsDialog([FromQuery] string folder, [FromQuery] WorkflowStep step)
    {
        if (string.IsNullOrWhiteSpace(folder))
            return BadRequest();

        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var vm = await _folderBatchService.GetDistributeDialogAsync(folder, step, currentUser);
        return PartialView("~/Modules/Features/Dashboard/Views/Construction/_DistributeFormsModal.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> DistributeForms(ConstructionDistributeFormsRequest request)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _folderBatchService.DistributeFormsAsync(request, currentUser);
        if (!result.Success)
        {
            TempData["Error"] = result.Message;
        }
        else
        {
            TempData["Success"] = result.Message;
        }

        return RedirectToAction(nameof(Batches), new { folder = request.FolderPath, q = request.Filter });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> ReclaimForms([FromForm] string folder, [FromForm] WorkflowStep step, [FromForm] string? q = null)
    {
        if (string.IsNullOrWhiteSpace(folder))
            return BadRequest("Thư mục không hợp lệ.");

        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _folderBatchService.ReclaimFormsAsync(folder, step, currentUser);
        
        if (!result.Success)
            TempData["Error"] = result.Message;
        else
            TempData["Success"] = result.Message;

        return RedirectToAction(nameof(Batches), new { folder, q });
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public IActionResult CreateBatch()
        => View("~/Modules/Features/Dashboard/Views/Construction/CreateBatch.cshtml", new ConstructionCreateBatchRequest());

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> CreateBatch(ConstructionCreateBatchRequest req)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _batchService.CreateBatchAsync(req, currentUser);
        if (!result.Success)
        {
            TempData["Error"] = result.Message;
            return View("~/Modules/Features/Dashboard/Views/Construction/CreateBatch.cshtml", req);
        }

        TempData["Success"] = result.Message ?? "Đã tạo bộ hồ sơ.";
        return RedirectToAction(nameof(BatchDetails), new { id = result.Data });
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> BatchDetails([FromRoute] long id)
    {
        var vm = await _batchService.GetBatchDetailsAsync(id);
        if (vm is null) return NotFound();
        var users = await HttpContext.RequestServices.GetRequiredService<IUserRepository>().GetActiveUsersAsync();
        ViewBag.ActiveUsers = users.ToList();
        return View("~/Modules/Features/Dashboard/Views/Construction/BatchDetails.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> AssignBatch(long id, [FromForm] List<int> userIds, [FromForm] List<WorkflowStep> steps)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var items = new List<ConstructionAssignUserStepItem>();
        foreach (var uid in userIds.Distinct())
        {
            foreach (var st in steps.Distinct())
                items.Add(new ConstructionAssignUserStepItem { UserId = uid, Step = st });
        }

        var result = await _batchService.AssignBatchAsync(new ConstructionAssignBatchRequest
        {
            BatchId = id,
            Items = items
        }, currentUser);

        if (!result.Success)
            TempData["Error"] = result.Message;
        else
            TempData["Success"] = result.Message;

        return RedirectToAction(nameof(BatchDetails), new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> UpdateBatchStatus(long id, [FromForm] ConstructionBatchStatus status)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _batchService.UpdateBatchStatusAsync(id, status, currentUser);
        if (!result.Success)
            TempData["Error"] = result.Message;
        else
            TempData["Success"] = result.Message;
        return RedirectToAction(nameof(BatchDetails), new { id });
    }

    [HttpGet]
    [AuthorizeModule(
        ModuleCode.Report,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm,
        ModuleCode.CheckFirst,
        ModuleCode.CheckSecond,
        ModuleCode.CheckFinal,
        ModuleCode.CheckLogic)]
    public async Task<IActionResult> Kpi([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int? userId = null)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) userId = currentUser.Id;
        var fromDate = (from ?? DateTime.Today).Date;
        var toDate = (to ?? DateTime.Today).Date;
        if (toDate < fromDate) toDate = fromDate;
        var vm = await _kpiPayrollService.GetKpiDashboardAsync(fromDate, toDate, userId);
        ViewBag.IsAdmin = currentUser.IsAdmin;
        return View("~/Modules/Features/Dashboard/Views/Construction/Kpi.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(
        ModuleCode.Report,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm,
        ModuleCode.CheckFirst,
        ModuleCode.CheckSecond,
        ModuleCode.CheckFinal,
        ModuleCode.CheckLogic)]
    public async Task<IActionResult> RecalculateKpi([FromForm] DateTime workDate)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        int? targetUserId = currentUser.IsAdmin ? null : currentUser.Id;
        var result = await _kpiPayrollService.RecalculateKpiAsync(workDate.Date, currentUser, targetUserId);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi), new { from = workDate.Date, to = workDate.Date });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveKpiConfig(SaveConstructionKpiConfigRequest request)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var result = await _kpiPayrollService.SaveKpiConfigAsync(request, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi));
    }

    [HttpGet]
    public async Task<IActionResult> CreateKpiConfig([FromQuery] ConstructionKpiRole role = ConstructionKpiRole.CheckScan)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var cfg = await _kpiPayrollService.GetKpiRoleConfigAsync(role);
        var vm = new ConstructionKpiConfigUpsertViewModel
        {
            IsEdit = false,
            Title = $"Tạo cấu hình KPI - {ConstructionKpiConfig.DisplayName(role)}",
            Form = new SaveConstructionKpiConfigRequest
            {
                Role = role,
                DailyTarget = cfg?.DailyTarget ?? 1,
                MinQualityPercent = cfg?.MinQualityPercent ?? 0,
                BonusTiers = (cfg?.BonusTiers ?? new List<ConstructionKpiBonusTierDto>()).ToList()
            }
        };
        while (vm.Form.BonusTiers.Count < 3) vm.Form.BonusTiers.Add(new ConstructionKpiBonusTierDto());
        return View("~/Modules/Features/Dashboard/Views/Construction/UpsertKpiConfig.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateKpiConfig(ConstructionKpiConfigUpsertViewModel vm)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var result = await _kpiPayrollService.SaveKpiConfigAsync(vm.Form, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        if (result.Success) return RedirectToAction(nameof(Kpi));

        vm.IsEdit = false;
        vm.Title = $"Tạo cấu hình KPI - {ConstructionKpiConfig.DisplayName(vm.Form.Role)}";
        while (vm.Form.BonusTiers.Count < 3) vm.Form.BonusTiers.Add(new ConstructionKpiBonusTierDto());
        return View("~/Modules/Features/Dashboard/Views/Construction/UpsertKpiConfig.cshtml", vm);
    }

    [HttpGet]
    public async Task<IActionResult> EditKpiConfig([FromQuery] ConstructionKpiRole role)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var cfg = await _kpiPayrollService.GetKpiRoleConfigAsync(role);
        if (cfg is null) return NotFound();

        var vm = new ConstructionKpiConfigUpsertViewModel
        {
            IsEdit = true,
            Title = $"Sửa cấu hình KPI - {cfg.DisplayName}",
            Form = new SaveConstructionKpiConfigRequest
            {
                Role = cfg.Role,
                DailyTarget = cfg.DailyTarget,
                MinQualityPercent = cfg.MinQualityPercent,
                BonusTiers = cfg.BonusTiers.ToList()
            }
        };
        while (vm.Form.BonusTiers.Count < 3) vm.Form.BonusTiers.Add(new ConstructionKpiBonusTierDto());
        return View("~/Modules/Features/Dashboard/Views/Construction/UpsertKpiConfig.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditKpiConfig(ConstructionKpiConfigUpsertViewModel vm)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var result = await _kpiPayrollService.SaveKpiConfigAsync(vm.Form, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        if (result.Success) return RedirectToAction(nameof(Kpi));

        vm.IsEdit = true;
        vm.Title = $"Sửa cấu hình KPI - {ConstructionKpiConfig.DisplayName(vm.Form.Role)}";
        while (vm.Form.BonusTiers.Count < 3) vm.Form.BonusTiers.Add(new ConstructionKpiBonusTierDto());
        return View("~/Modules/Features/Dashboard/Views/Construction/UpsertKpiConfig.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteKpiConfig([FromForm] ConstructionKpiRole role)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAdmin) return Forbid();
        var result = await _kpiPayrollService.DeleteKpiConfigAsync(role, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi));
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> Payroll([FromQuery] int? year = null, [FromQuery] int? month = null, [FromQuery] int? userId = null)
    {
        var now = DateTime.Today;
        var y = year ?? now.Year;
        var m = month ?? now.Month;
        var vm = await _kpiPayrollService.GetPayrollDashboardAsync(y, m, userId);
        return View("~/Modules/Features/Dashboard/Views/Construction/Payroll.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> RecalculatePayroll([FromForm] int year, [FromForm] int month)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.RecalculatePayrollAsync(year, month, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Payroll), new { year, month });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> ApprovePayroll([FromForm] long id, [FromForm] int year, [FromForm] int month)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.ApprovePayrollAsync(id, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Payroll), new { year, month });
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> FolderProgress([FromQuery] string? q = null)
    {
        var vm = await _folderProgress.GetAsync(q);
        return View("~/Modules/Features/SoHoa/Views/Report/FolderProgress.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> PurgeFolderDocuments([FromForm] string folder, [FromQuery] string? q = null)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _folderPurge.PurgeVirtualFolderAsync(folder, currentUser, HttpContext.RequestAborted).ConfigureAwait(false);

        if (!result.Success)
        {
            TempData["Error"] = result.Message;
            return RedirectToAction(nameof(FolderProgress), new { q });
        }

        if (result.DocumentsAffected == 0)
            TempData["Info"] = result.Message;
        else
            TempData["Success"] = result.Message;

        if (result.Warnings is { Count: > 0 })
        {
            var sample = string.Join("; ", result.Warnings.Take(5));
            TempData["Warning"] = $"Một số file trên storage có thể chưa đổi tên hậu tố _deleteat (kiểm tra log): {sample}";
        }

        return RedirectToAction(nameof(FolderProgress), new { q });
    }

    /// <summary>Đưa lại các tài liệu OCR-lỗi của thư mục về hàng đợi để chạy lại OCR.</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.Report)]
    public async Task<IActionResult> RequeueFailedOcr([FromForm] string folder, [FromQuery] string? q = null)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _folderOcrRetry.RequeueFailedAsync(folder, currentUser, HttpContext.RequestAborted).ConfigureAwait(false);

        if (!result.Success)
            TempData["Error"] = result.Message;
        else if (result.DocumentsSkipped > 0)
            TempData["Warning"] = result.Message;
        else if (result.DocumentsAffected == 0)
            TempData["Info"] = result.Message;
        else
            TempData["Success"] = result.Message;

        return RedirectToAction(nameof(FolderProgress), new { q });
    }
}
