using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Identity;

namespace SHTL.Modules.Features.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.Report)]
public class ReportController : BaseController
{
    private readonly IFolderProgressReportService _folderProgress;
    private readonly IFolderDocumentsPurgeService _folderPurge;
    private readonly IFolderOcrRetryService _folderOcrRetry;

    public ReportController(
        IFolderProgressReportService folderProgress,
        IFolderDocumentsPurgeService folderPurge,
        IFolderOcrRetryService folderOcrRetry)
    {
        _folderProgress = folderProgress;
        _folderPurge = folderPurge;
        _folderOcrRetry = folderOcrRetry;
    }

    [HttpGet("/sohoa/report/folder-progress")]
    public async Task<IActionResult> FolderProgress([FromQuery] string? q = null)
    {
        var vm = await _folderProgress.GetAsync(q);
        return View(vm);
    }

    /// <summary>Xóa toàn bộ tài liệu đang hoạt động trong một “thư mục ảo” (khớp bảng tiến độ).</summary>
    [HttpPost("/sohoa/report/folder-progress/purge")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PurgeFolderDocuments([FromForm] string folder, [FromQuery] string? q = null)
    {
        var result = await _folderPurge.PurgeVirtualFolderAsync(folder, CurrentUser, HttpContext.RequestAborted).ConfigureAwait(false);
        if (!result.Success)
        {
            SetError(result.Message);
            return RedirectToAction(nameof(FolderProgress), new { q });
        }

        if (result.DocumentsAffected == 0)
            SetInfo(result.Message);
        else
            SetSuccess(result.Message);

        if (result.Warnings is { Count: > 0 })
        {
            var sample = string.Join("; ", result.Warnings.Take(5));
            SetWarning($"Một số file trên storage có thể chưa đổi tên hậu tố _deleteat (kiểm tra log): {sample}");
        }

        return RedirectToAction(nameof(FolderProgress), new { q });
    }

    /// <summary>Đưa lại các tài liệu OCR-lỗi của thư mục về hàng đợi để chạy lại OCR.</summary>
    [HttpPost("/sohoa/report/folder-progress/ocr-retry")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RequeueFailedOcr([FromForm] string folder, [FromQuery] string? q = null)
    {
        var result = await _folderOcrRetry.RequeueFailedAsync(folder, CurrentUser, HttpContext.RequestAborted).ConfigureAwait(false);

        if (!result.Success)
            SetError(result.Message);
        else if (result.DocumentsSkipped > 0)
            SetWarning(result.Message);
        else if (result.DocumentsAffected == 0)
            SetInfo(result.Message);
        else
            SetSuccess(result.Message);

        return RedirectToAction(nameof(FolderProgress), new { q });
    }
}
