using System.ComponentModel.DataAnnotations;

namespace Shared.Contracts.Dtos;

public class UserDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int DeptId { get; set; }
    public string? DeptName { get; set; }
    public int PositionId { get; set; }
    public string? PositionName { get; set; }
    public bool IsActive { get; set; }
    public bool IsAdmin { get; set; }
    public string? Avatar { get; set; }
    public string? Phone { get; set; }
    public DateTime? LastLogin { get; set; }
    public List<string> Roles { get; set; } = new();
}

public class LoginRequest
{
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int ChannelId { get; set; }
    public bool RememberMe { get; set; }
}

public class LoginResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Token { get; set; }
    public UserDto? User { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class CreateUserRequest
{
    public int ChannelId { get; set; }

    [Required, Display(Name = "Tên đăng nhập")]
    public string UserName { get; set; } = string.Empty;

    [Required, EmailAddress, Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Required, Display(Name = "Họ và tên")]
    public string FullName { get; set; } = string.Empty;

    [Required, MinLength(6), Display(Name = "Mật khẩu")]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Phòng ban")]
    public int DeptId { get; set; }

    [Display(Name = "Chức vụ (mã)")]
    public int PositionId { get; set; }

    [Display(Name = "Quản trị viên")]
    public bool IsAdmin { get; set; }

    [Display(Name = "Điện thoại")]
    public string? Phone { get; set; }

    public List<int> RoleIds { get; set; } = new();
}

public class UpdateUserRequest
{
    public int Id { get; set; }

    [Required, EmailAddress, Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Required, Display(Name = "Họ và tên")]
    public string FullName { get; set; } = string.Empty;

    [Display(Name = "Điện thoại")]
    public string? Phone { get; set; }

    [Display(Name = "Phòng ban")]
    public int DeptId { get; set; }

    [Display(Name = "Chức vụ (mã)")]
    public int PositionId { get; set; }

    [Display(Name = "Tài khoản hoạt động")]
    public bool IsActive { get; set; } = true;

    [Display(Name = "Quản trị viên")]
    public bool IsAdmin { get; set; }
}

public class AdminResetPasswordRequest
{
    [Required, MinLength(6), Display(Name = "Mật khẩu mới")]
    public string NewPassword { get; set; } = string.Empty;

    [Required, Compare(nameof(NewPassword)), Display(Name = "Xác nhận mật khẩu")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
