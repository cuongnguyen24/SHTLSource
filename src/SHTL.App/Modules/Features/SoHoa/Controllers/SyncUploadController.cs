using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Shared.Contracts.Dtos;
using System.Text.Json;

namespace SHTL.Modules.Features.SoHoa.Controllers;

/// <summary>Upload tài liệu qua trình duyệt theo cấu hình loại đồng bộ (đường dẫn + Format), không cần plugin.</summary>
[Authorize]
[AuthorizeModule(ModuleCode.ScanUpload)]
[Route("sohoa/dong-bo-upload")]
public class SyncUploadController : BaseController
{
    private readonly IDocumentSyncUploadService _upload;
    private readonly SHTL.Modules.Infrastructure.Data.Repositories.Stg.IAxeSyncTypeRepository _syncTypes;

    public SyncUploadController(
        IDocumentSyncUploadService upload,
        SHTL.Modules.Infrastructure.Data.Repositories.Stg.IAxeSyncTypeRepository syncTypes)
    {
        _upload = upload;
        _syncTypes = syncTypes;
    }

    private void SetPageHeader()
    {
        ViewData["Title"] = "Upload đồng bộ";
        ViewData["PageTitle"] = "Upload đồng bộ (theo loại đồng bộ)";
        ViewData["PageIcon"] = "cloud-upload-alt";
        ViewData["Breadcrumbs"] = new List<SHTL.Modules.Features.Shared.BreadcrumbItem>
        {
            new() { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new() { Text = "Upload đồng bộ" }
        };
    }

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        SetPageHeader();
        var list = await _syncTypes.ListAsync(null);
        return View(list);
    }

    [HttpPost("submit")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(long.MaxValue)]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public async Task<IActionResult> Submit([FromForm] List<int> syncTypeIds, [FromForm] string? pathPrefix, CancellationToken cancellationToken)
    {
        syncTypeIds = (syncTypeIds ?? new List<int>())
            .Where(x => x > 0)
            .Distinct()
            .ToList();
        if (syncTypeIds.Count == 0)
        {
            SetError("Chọn ít nhất một loại đồng bộ.");
            return RedirectToAction(nameof(Index));
        }

        var posted = Request.Form.Files.Where(f => string.Equals(f.Name, "files", StringComparison.OrdinalIgnoreCase)).ToList();
        var paths = Request.Form["relativePaths"];
        if (posted.Count == 0)
        {
            SetError("Không có file nào để upload, upload thất bại.");
            return RedirectToAction(nameof(Index));
        }

        var items = new List<SyncUploadFormFile>(posted.Count);
        for (var i = 0; i < posted.Count; i++)
        {
            var p = i < paths.Count ? paths[i]!.ToString() : posted[i].FileName;
            items.Add(new SyncUploadFormFile { File = posted[i], RelativePath = p ?? posted[i].FileName });
        }

        var onlyPdf = Request.Form.TryGetValue("onlyPdf", out var op)
            && op.Any(v => v == "1" || string.Equals(v, "on", StringComparison.OrdinalIgnoreCase));

        var result = await _upload.UploadAsync(CurrentUser.Id, syncTypeIds, items, onlyPdf, pathPrefix, cancellationToken);
        if (result.SuccessCount > 0 && result.FailCount == 0)
            SetSuccess($"Đã nhập {result.SuccessCount} tài liệu.");
        else if (result.SuccessCount > 0)
            SetWarning($"Thành công {result.SuccessCount}, lỗi {result.FailCount}. Xem chi tiết bên dưới.");
        else
            SetError("Không có tài liệu nào được lưu.");

        TempData["SyncUploadResult"] = JsonSerializer.Serialize(result.Items);
        return RedirectToAction(nameof(Result));
    }

    [HttpGet("ket-qua")]
    public IActionResult Result()
    {
        SetPageHeader();
        ViewData["PageTitle"] = "Kết quả upload đồng bộ";
        var json = TempData["SyncUploadResult"] as string;
        List<WebSyncUploadItemResult> items;
        if (string.IsNullOrEmpty(json))
            items = new List<WebSyncUploadItemResult>();
        else
            items = JsonSerializer.Deserialize<List<WebSyncUploadItemResult>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    ?? new List<WebSyncUploadItemResult>();
        return View(items);
    }
}
