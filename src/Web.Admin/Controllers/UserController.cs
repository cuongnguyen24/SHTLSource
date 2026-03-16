using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.Admin.Controllers;

public class UserController : BaseAdminController
{
    private readonly IUserManagementService _userService;

    public UserController(IUserManagementService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var req = GetPageRequest();
        var result = await _userService.GetListAsync(ChannelId, req.PageIndex, req.PageSize, req.Search);
        ViewBag.Search = req.Search;
        return View(result);
    }

    [HttpGet]
    public IActionResult Create() => View(new CreateUserRequest { ChannelId = ChannelId });

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateUserRequest model)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await _userService.CreateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message ?? "Tạo người dùng thất bại");
            return View(model);
        }
        SetSuccess("Tạo người dùng thành công");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var user = await _userService.GetByIdAsync(id);
        if (user is null) return NotFound();
        return View(user);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(int id, bool isActive)
    {
        var result = await _userService.SetActiveAsync(id, isActive, CurrentUser);
        return JsonResult(result);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(int userId, ChangePasswordRequest model)
    {
        var result = await _userService.ChangePasswordAsync(userId, model);
        return JsonResult(result);
    }
}
