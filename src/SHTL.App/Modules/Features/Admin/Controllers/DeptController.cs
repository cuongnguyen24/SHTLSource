using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.Admin.Controllers;

public class DeptController : BaseAdminController
{
    private readonly IDeptService _deptService;

    public DeptController(IDeptService deptService)
    {
        _deptService = deptService;
    }

    public async Task<IActionResult> Index()
    {
        var search = Request.Query["q"].ToString().Trim();
        var list = await _deptService.GetListAsync(string.IsNullOrEmpty(search) ? null : search);
        ViewBag.Search = search;
        SetPageHeader("Phòng ban", "sitemap",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Phòng ban" });
        return View(list);
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(null);
        SetPageHeader("Tạo phòng ban", "plus-circle",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Phòng ban", Url = Url.Action("Index", "Dept") },
            new BreadcrumbItem { Text = "Tạo mới" });
        return View(new CreateDeptRequest());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateDeptRequest model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(null);
            SetPageHeader("Tạo phòng ban", "plus-circle",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Phòng ban", Url = Url.Action("Index", "Dept") },
                new BreadcrumbItem { Text = "Tạo mới" });
            return View(model);
        }

        var result = await _deptService.CreateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message!);
            ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(null);
            SetPageHeader("Tạo phòng ban", "plus-circle",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Phòng ban", Url = Url.Action("Index", "Dept") },
                new BreadcrumbItem { Text = "Tạo mới" });
            return View(model);
        }
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
            Describe = dept.Describe,
            ParentId = dept.ParentId
        };
        ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(id);
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
        if (!ModelState.IsValid)
        {
            ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(model.Id);
            SetPageHeader("Sửa phòng ban", "edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Phòng ban", Url = Url.Action("Index", "Dept") },
                new BreadcrumbItem { Text = model.Name });
            return View(model);
        }

        var result = await _deptService.UpdateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message!);
            ViewBag.ParentOptions = await _deptService.GetParentOptionsAsync(model.Id);
            SetPageHeader("Sửa phòng ban", "edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Phòng ban", Url = Url.Action("Index", "Dept") },
                new BreadcrumbItem { Text = model.Name });
            return View(model);
        }
        SetSuccess("Cập nhật phòng ban thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _deptService.DeleteAsync(id, CurrentUser);
        return JsonResult(result);
    }
}
