using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Identity;

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

    public ConstructionController(
        IFolderProgressReportService folderProgress,
        IFolderDocumentsPurgeService folderPurge,
        IFolderOcrRetryService folderOcrRetry)
    {
        _folderProgress = folderProgress;
        _folderPurge = folderPurge;
        _folderOcrRetry = folderOcrRetry;
    }

    /// <summary>Trang tổng quan của khu vực "Tiến độ thi công" — liệt kê các báo cáo con.</summary>
    [HttpGet]
    public IActionResult Index() => View();

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
            TempData["Warning"] = $"Một số file trên storage có thể chưa xóa hết (kiểm tra log): {sample}";
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
