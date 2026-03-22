using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Shared;

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
        SetPageHeader("Người dùng", "users",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Người dùng" });
        ViewData["SearchQuery"] = req.Search;
        ViewData["SearchPlaceholder"] = "Tìm theo tên, email, tài khoản...";
        ViewData["PrimaryButtonText"] = "Tạo mới";
        ViewData["PrimaryButtonUrl"] = Url.Action("Create", "User");
        return View(result);
    }

    [HttpGet]
    public IActionResult Create()
    {
        SetPageHeader("Tạo người dùng", "user-plus",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
            new BreadcrumbItem { Text = "Tạo mới" });
        return View(new CreateUserRequest { ChannelId = ChannelId });
    }

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
        SetPageHeader("Chi tiết người dùng", "user-edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
            new BreadcrumbItem { Text = user.UserName });
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
