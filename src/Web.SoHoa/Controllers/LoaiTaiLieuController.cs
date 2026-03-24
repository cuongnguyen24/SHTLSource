using Core.Application.Services.Axe;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Cnf;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Web.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.DocTypeConfig)]
[Route("loai-tai-lieu")]
public class LoaiTaiLieuController : BaseController
{
    private readonly IAxeDocTypeAdminService _axe;
    private readonly ICnfRepository _cnf;

    public LoaiTaiLieuController(IAxeDocTypeAdminService axe, ICnfRepository cnf)
    {
        _axe = axe;
        _cnf = cnf;
    }

    private void SetPageHeader(string title)
    {
        ViewData["Title"] = title;
        ViewData["PageTitle"] = title;
        ViewData["PageIcon"] = "tags";
        ViewData["Breadcrumbs"] = new List<Web.Shared.BreadcrumbItem>
        {
            new() { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new() { Text = "Loại tài liệu" }
        };
    }

    [HttpGet("")]
    [HttpGet("/doctype")]
    [HttpGet("/doctype.html")]
    public async Task<IActionResult> Index([FromQuery] string? q)
    {
        SetPageHeader("Loại tài liệu");
        ViewBag.Search = q;
        ViewBag.DocTypeContentTypes = (await _cnf.GetDocTypeContentTypesAsync(ChannelId)).ToList();
        var list = await _axe.GetIndexAsync(ChannelId, q);
        return View(list);
    }

    [HttpGet("create")]
    [HttpGet("/doctype/create")]
    [HttpGet("/doctype/create/{contentTypeId:int}")]
    public async Task<IActionResult> Create([FromQuery] int? contentTypeId)
    {
        SetPageHeader("Tạo loại tài liệu");
        var vm = await _axe.GetCreatePageAsync(ChannelId, contentTypeId);
        return View("Form", vm);
    }

    [HttpPost("create")]
    [HttpPost("save")]
    [HttpPost("/doctype/save")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateSubmit()
    {
        var result = await _axe.SaveAsync(ChannelId, CurrentUser.Id, 0, Request.Form, true);
        if (!result.Success)
        {
            SetError(result.Message ?? "Lỗi");
            var vm = await _axe.GetCreatePageAsync(ChannelId, null);
            return View("Form", vm);
        }
        SetSuccess(result.Message ?? "Đã lưu");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("edit/{id:int}")]
    [HttpGet("/doctype/update/{id:int}")]
    public async Task<IActionResult> Edit(int id)
    {
        var vm = await _axe.GetEditPageAsync(ChannelId, id);
        if (vm == null)
            return NotFound();
        SetPageHeader("Sửa loại tài liệu");
        return View("Form", vm);
    }

    [HttpPost("edit/{id:int}")]
    [HttpPost("change/{id:int}")]
    [HttpPost("/doctype/change/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditSubmit(int id)
    {
        var result = await _axe.SaveAsync(ChannelId, CurrentUser.Id, id, Request.Form, false);
        if (!result.Success)
        {
            SetError(result.Message ?? "Lỗi");
            var vm = await _axe.GetEditPageAsync(ChannelId, id);
            return vm == null ? NotFound() : View("Form", vm);
        }
        SetSuccess(result.Message ?? "Đã lưu");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("clone/{id:int}")]
    [HttpGet("/doctype/clone/{id:int}")]
    public async Task<IActionResult> Clone(int id)
    {
        var result = await _axe.CloneAsync(ChannelId, CurrentUser.Id, id);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã sao chép");
        else
            SetError(result.Message ?? "Lỗi");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("delete/{id:int}")]
    [HttpPost("/doctype/delete/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _axe.DeleteAsync(ChannelId, id);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã xóa");
        else
            SetError(result.Message ?? "Không xóa được");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("deletes")]
    [HttpPost("/doctype/deletes")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Deletes([FromForm] List<int> ids)
    {
        if (ids == null || ids.Count == 0)
        {
            SetWarning("Bạn chưa chọn loại tài liệu cần xóa.");
            return RedirectToAction(nameof(Index));
        }

        var deleted = 0;
        var errors = new List<string>();
        foreach (var id in ids.Distinct())
        {
            var result = await _axe.DeleteAsync(ChannelId, id);
            if (result.Success) deleted++;
            else if (!string.IsNullOrWhiteSpace(result.Message)) errors.Add($"#{id}: {result.Message}");
        }

        if (deleted > 0)
            SetSuccess($"Đã xóa {deleted} loại tài liệu.");
        if (errors.Count > 0)
            SetError("Một số bản ghi chưa xóa được: " + string.Join(" | ", errors.Take(5)));

        return RedirectToAction(nameof(Index));
    }

    [HttpGet("sortable/{id:int}")]
    [HttpGet("/doctype/sortable/{id:int}")]
    public async Task<IActionResult> Sortable(int id)
    {
        var vm = await _axe.GetSortablePageAsync(ChannelId, id);
        if (vm == null)
            return RedirectToAction(nameof(Index));
        SetPageHeader("Sắp xếp trường thông tin");
        return View(vm);
    }

    [HttpPost("sortable/{id:int}")]
    [HttpPost("/doctype/sortable-change/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SortableSubmit(int id)
    {
        var result = await _axe.SaveSortableAsync(ChannelId, id, Request.Form);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã lưu");
        else
            SetError(result.Message ?? "Lỗi");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("separate/{id:int}")]
    [HttpGet("/doctype/separate/{id:int}")]
    public async Task<IActionResult> Separate(int id)
    {
        var vm = await _axe.GetSeparatePageAsync(ChannelId, id);
        if (vm == null)
            return RedirectToAction(nameof(Index));
        SetPageHeader("Cấu hình phân tách trang");
        return View(vm);
    }

    [HttpPost("separate/{id:int}")]
    [HttpPost("/doctype/separate-change/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SeparateSubmit(int id)
    {
        var result = await _axe.SaveSeparateAsync(ChannelId, id, Request.Form);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã lưu");
        else
            SetError(result.Message ?? "Lỗi");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("ocr-fix/{id:int}")]
    [HttpGet("/doctype/ocr-fix/{id:int}")]
    public async Task<IActionResult> OcrFix(int id)
    {
        var vm = await _axe.GetOcrFixPageAsync(ChannelId, id);
        if (vm == null)
            return RedirectToAction(nameof(Index));
        SetPageHeader("Cấu hình chỉnh sửa hậu OCR");
        return View(vm);
    }

    [HttpPost("ocr-fix/save-field")]
    [HttpPost("/doctype/ocr-fix/save")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> OcrFixSaveField([FromForm] int idDoctype)
    {
        var result = await _axe.SaveOcrFixFieldAsync(ChannelId, CurrentUser.Id, idDoctype, Request.Form);
        return Json(new { success = result.Success, message = result.Message });
    }

    [HttpPost("ocr-fix/preview")]
    [HttpPost("/doctype/ocr-fix/example")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> OcrFixPreview([FromForm] int idDoctype)
    {
        var text = await _axe.PreviewOcrFixAsync(ChannelId, idDoctype, Request.Form);
        return Json(new { success = true, result = text });
    }
}
