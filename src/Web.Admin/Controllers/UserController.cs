using Core.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Shared;

namespace Web.Admin.Controllers;

public class UserController : BaseAdminController
{
    private readonly IUserManagementService _userService;
    private readonly IDeptService _deptService;

    public UserController(IUserManagementService userService, IDeptService deptService)
    {
        _userService = userService;
        _deptService = deptService;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var req = GetPageRequest();
        var result = await _userService.GetListAsync(ChannelId, req.PageIndex, req.PageSize, req.Search);
        ViewBag.Search = req.Search;
        ViewData["MeUserId"] = CurrentUser.Id;
        SetPageHeader("Người dùng", "users",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Tài khoản hệ thống" },
            new BreadcrumbItem { Text = "Người dùng" });
        ViewData["SearchQuery"] = req.Search;
        ViewData["SearchPlaceholder"] = "Tìm theo tên, email, tài khoản...";
        ViewData["PrimaryButtonText"] = "Tạo mới";
        ViewData["PrimaryButtonUrl"] = Url.Action("Create", "User");
        return View(result);
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
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
        if (!ModelState.IsValid)
        {
            ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
            SetPageHeader("Tạo người dùng", "user-plus",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
                new BreadcrumbItem { Text = "Tạo mới" });
            return View(model);
        }

        var result = await _userService.CreateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message ?? "Tạo người dùng thất bại");
            ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
            SetPageHeader("Tạo người dùng", "user-plus",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
                new BreadcrumbItem { Text = "Tạo mới" });
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
        ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
        SetPageHeader("Sửa người dùng", "user-edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
            new BreadcrumbItem { Text = user.UserName });
        ViewBag.UserNameReadOnly = user.UserName;
        return View(ToUpdateRequest(user));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(UpdateUserRequest model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
            var u = await _userService.GetByIdAsync(model.Id);
            ViewBag.UserNameReadOnly = u?.UserName;
            SetPageHeader(u is null ? "Sửa người dùng" : $"Sửa — {u.UserName}", "user-edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
                new BreadcrumbItem { Text = u?.UserName ?? "?" });
            return View(model);
        }

        var result = await _userService.UpdateAsync(model, CurrentUser);
        if (!result.Success)
        {
            SetError(result.Message ?? "Cập nhật thất bại");
            ViewBag.Depts = await _deptService.GetListAsync(ChannelId);
            var u = await _userService.GetByIdAsync(model.Id);
            ViewBag.UserNameReadOnly = u?.UserName;
            SetPageHeader(u is null ? "Sửa người dùng" : $"Sửa — {u.UserName}", "user-edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Người dùng", Url = Url.Action("Index", "User") },
                new BreadcrumbItem { Text = u?.UserName ?? "?" });
            return View(model);
        }

        SetSuccess(result.Message ?? "Đã lưu");
        return RedirectToAction(nameof(Edit), new { id = model.Id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetPassword(int userId, AdminResetPasswordRequest model)
    {
        if (!ModelState.IsValid)
        {
            SetError(string.Join(" ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
            return RedirectToAction(nameof(Edit), new { id = userId });
        }

        var result = await _userService.AdminResetPasswordAsync(userId, model, CurrentUser);
        if (result.Success) SetSuccess(result.Message!);
        else SetError(result.Message ?? "Đặt lại mật khẩu thất bại");
        return RedirectToAction(nameof(Edit), new { id = userId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetActive(int id, bool isActive)
    {
        var result = await _userService.SetActiveAsync(id, isActive, CurrentUser);
        if (result.Success) SetSuccess(result.Message!);
        else SetError(result.Message ?? "Thất bại");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(int userId, ChangePasswordRequest model)
    {
        var result = await _userService.ChangePasswordAsync(userId, model);
        return JsonResult(result);
    }

    private static UpdateUserRequest ToUpdateRequest(UserDto u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        FullName = u.FullName,
        Phone = u.Phone,
        DeptId = u.DeptId,
        PositionId = u.PositionId,
        IsActive = u.IsActive,
        IsAdmin = u.IsAdmin
    };
}
