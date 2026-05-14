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
[AuthorizeModule(ModuleCode.Report)]
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
    public async Task<IActionResult> Index()
    {
        var vm = await _batchService.GetDashboardAsync();
        return View(vm);
    }

    [HttpGet]
    public async Task<IActionResult> Batches([FromQuery] string? folder = null, [FromQuery] string? q = null)
    {
        var vm = await _folderBatchService.GetFolderPageAsync(folder, q);
        return View("~/Modules/Features/Dashboard/Views/Construction/Batches.cshtml", vm);
    }

    [HttpGet]
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
    public IActionResult CreateBatch()
        => View("~/Modules/Features/Dashboard/Views/Construction/CreateBatch.cshtml", new ConstructionCreateBatchRequest());

    [HttpPost]
    [ValidateAntiForgeryToken]
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
    public async Task<IActionResult> Kpi([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int? userId = null)
    {
        var fromDate = (from ?? DateTime.Today).Date;
        var toDate = (to ?? DateTime.Today).Date;
        if (toDate < fromDate) toDate = fromDate;
        var vm = await _kpiPayrollService.GetKpiDashboardAsync(fromDate, toDate, userId);
        return View("~/Modules/Features/Dashboard/Views/Construction/Kpi.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RecalculateKpi([FromForm] DateTime workDate)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.RecalculateKpiAsync(workDate.Date, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi), new { from = workDate.Date, to = workDate.Date });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CheckIn([FromForm] string? notes = null)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.CheckInAsync(currentUser, null, notes);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi), new { from = DateTime.Today, to = DateTime.Today });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CheckOut([FromForm] string? notes = null)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.CheckOutAsync(currentUser, null, notes);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Kpi), new { from = DateTime.Today, to = DateTime.Today });
    }

    [HttpGet]
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
    public async Task<IActionResult> RecalculatePayroll([FromForm] int year, [FromForm] int month)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.RecalculatePayrollAsync(year, month, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Payroll), new { year, month });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ApprovePayroll([FromForm] long id, [FromForm] int year, [FromForm] int month)
    {
        var currentUser = HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var result = await _kpiPayrollService.ApprovePayrollAsync(id, currentUser);
        TempData[result.Success ? "Success" : "Error"] = result.Message;
        return RedirectToAction(nameof(Payroll), new { year, month });
    }

    [HttpGet]
    public async Task<IActionResult> FolderProgress([FromQuery] string? q = null)
    {
        var vm = await _folderProgress.GetAsync(q);
        return View("~/Modules/Features/SoHoa/Views/Report/FolderProgress.cshtml", vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
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
