using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.Admin.Controllers;

public class RoleController : BaseAdminController
{
    private readonly IRoleService _roleService;

    public RoleController(IRoleService roleService)
    {
        _roleService = roleService;
    }

    public async Task<IActionResult> Index()
    {
        var list = await _roleService.GetListAsync();
        SetPageHeader("Vai trò & nhóm quyền", "user-shield",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Vai trò" });
        return View(list);
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var role = await _roleService.GetByIdAsync(id);
        if (role is null)
        {
            SetError("Vai trò không tồn tại");
            return RedirectToAction(nameof(Index));
        }

        SetPageHeader("Sửa vai trò", "edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Vai trò", Url = Url.Action("Index", "Role") },
            new BreadcrumbItem { Text = "Sửa" });

        var vm = new EditRoleRequest
        {
            Id = role.Id,
            Code = role.Code,
            Name = role.Name,
            Description = role.Description
        };
        return View(vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(EditRoleRequest model)
    {
        if (!ModelState.IsValid)
        {
            // Bổ sung Code (readonly) lại từ DB để hiển thị nếu form post thiếu.
            if (string.IsNullOrWhiteSpace(model.Code))
            {
                var existing = await _roleService.GetByIdAsync(model.Id);
                if (existing is not null) model.Code = existing.Code;
            }
            return View(model);
        }

        var result = await _roleService.UpdateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message ?? "Cập nhật thất bại");
            return View(model);
        }

        SetSuccess(result.Message ?? "Cập nhật vai trò thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SavePermissions(int roleId, List<string> permissions)
    {
        var result = await _roleService.SavePermissionsAsync(roleId, permissions, CurrentUser);
        return JsonResult(result);
    }
}
