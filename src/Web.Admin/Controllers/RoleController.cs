using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

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
        return View(list);
    }

    [HttpGet]
    public IActionResult Create() => View(new CreateRoleRequest { ChannelId = ChannelId });

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
