using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Infrastructure.Identity;

namespace SHTL.Modules.Features.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.SyncTypeConfig)]
[Route("sohoa/loai-dong-bo")]
public class LoaiDongBoController : BaseController
{
    private readonly IAxeSyncTypeAdminService _axe;

    public LoaiDongBoController(IAxeSyncTypeAdminService axe)
    {
        _axe = axe;
    }

    private void SetPageHeader(string title)
    {
        ViewData["Title"] = title;
        ViewData["PageTitle"] = title;
        ViewData["PageIcon"] = "sync";
        ViewData["Breadcrumbs"] = new List<BreadcrumbItem>
        {
            new() { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new() { Text = "Loại đồng bộ" }
        };
    }

    [HttpGet("")]
    public async Task<IActionResult> Index([FromQuery] string? q)
    {
        SetPageHeader("Loại đồng bộ");
        ViewBag.Search = q;
        var list = await _axe.GetIndexAsync(q);
        return View(list);
    }

    [HttpGet("create")]
    public async Task<IActionResult> Create()
    {
        SetPageHeader("Tạo loại đồng bộ");
        var vm = await _axe.GetCreatePageAsync();
        return View("Form", vm);
    }

    [HttpPost("create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateSubmit()
    {
        var result = await _axe.SaveAsync(CurrentUser.Id, 0, Request.Form, true);
        if (!result.Success)
        {
            SetError(result.Message ?? "Lỗi");
            return View("Form", await _axe.GetCreatePageAsync());
        }
        SetSuccess(result.Message ?? "Đã lưu");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("edit/{id:int}")]
    public async Task<IActionResult> Edit(int id)
    {
        var vm = await _axe.GetEditPageAsync(id);
        if (vm == null)
            return NotFound();
        SetPageHeader("Sửa loại đồng bộ");
        return View("Form", vm);
    }

    [HttpPost("edit/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditSubmit(int id)
    {
        var result = await _axe.SaveAsync(CurrentUser.Id, id, Request.Form, false);
        if (!result.Success)
        {
            SetError(result.Message ?? "Lỗi");
            var vm = await _axe.GetEditPageAsync(id);
            return vm == null ? NotFound() : View("Form", vm);
        }
        SetSuccess(result.Message ?? "Đã lưu");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("clone/{id:int}")]
    public async Task<IActionResult> Clone(int id)
    {
        var result = await _axe.CloneAsync(CurrentUser.Id, id);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã sao chép");
        else
            SetError(result.Message ?? "Lỗi");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("delete/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _axe.DeleteAsync(id);
        if (result.Success)
            SetSuccess(result.Message ?? "Đã xóa");
        else
            SetError(result.Message ?? "Không xóa được");
        return RedirectToAction(nameof(Index));
    }
}
