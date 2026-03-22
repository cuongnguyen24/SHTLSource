using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Shared;

namespace Web.Admin.Controllers;

public class RoleController : BaseAdminController
{
    private readonly IRoleService _roleService;

    public RoleController(IRoleService roleService)
    {
        _roleService = roleService;
    }

    public async Task<IActionResult> Index()
    {
        var list = await _roleService.GetListAsync(ChannelId);
        SetPageHeader("Vai trò & nhóm quyền", "user-shield",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Vai trò" });
        ViewData["PrimaryButtonText"] = "Tạo mới";
        ViewData["PrimaryButtonUrl"] = Url.Action("Create", "Role");
        return View(list);
    }

    [HttpGet]
    public IActionResult Create()
    {
        SetPageHeader("Tạo vai trò", "plus",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Vai trò", Url = Url.Action("Index", "Role") },
            new BreadcrumbItem { Text = "Tạo mới" });
        return View(new CreateRoleRequest { ChannelId = ChannelId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateRoleRequest model)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await _roleService.CreateAsync(model, CurrentUser);
        if (!result.Success) { SetError(result.Message!); return View(model); }
        SetSuccess("Tạo quyền thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _roleService.DeleteAsync(id, ChannelId, CurrentUser);
        return JsonResult(result);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SavePermissions(int roleId, List<string> permissions)
    {
        var result = await _roleService.SavePermissionsAsync(roleId, permissions, ChannelId, CurrentUser);
        return JsonResult(result);
    }
}
