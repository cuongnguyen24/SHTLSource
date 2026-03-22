using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Shared;

namespace Web.Admin.Controllers;

public class DeptController : BaseAdminController
{
    private readonly IDeptService _deptService;

    public DeptController(IDeptService deptService)
    {
        _deptService = deptService;
    }

    public async Task<IActionResult> Index()
    {
        var list = await _deptService.GetListAsync(ChannelId);
        return View(list);
    }

    [HttpGet]
    public IActionResult Create() => View(new CreateDeptRequest { ChannelId = ChannelId });

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateDeptRequest model)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await _deptService.CreateAsync(model, CurrentUser);
        if (!result.Success) { SetError(result.Message!); return View(model); }
        SetSuccess("Tạo phòng ban thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var dept = await _deptService.GetByIdAsync(id);
        if (dept is null) return NotFound();
        var model = new UpdateDeptRequest
        {
            Id = dept.Id,
            Name = dept.Name,
            Code = dept.Code,
            ParentId = dept.ParentId
        };
        SetPageHeader("Sửa phòng ban", "edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Cơ cấu", Url = Url.Action("Index", "Dept") },
            new BreadcrumbItem { Text = dept.Name });
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(UpdateDeptRequest model)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await _deptService.UpdateAsync(model, CurrentUser);
        if (!result.Success) { SetError(result.Message!); return View(model); }
        SetSuccess("Cập nhật phòng ban thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _deptService.DeleteAsync(id, ChannelId, CurrentUser);
        return JsonResult(result);
    }
}
