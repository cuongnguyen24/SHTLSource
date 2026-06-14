using System.ComponentModel.DataAnnotations;

namespace SHTL.Modules.Shared.Contracts.Dtos;

public class UserDto
{
    public int Id { get; set; }
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
    [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập")]
    [Display(Name = "Tên đăng nhập / Email")]
    public string UserName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

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
    [Required(ErrorMessage = "Vui lòng nhập tài khoản")]
    [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Tài khoản chỉ được chứa chữ cái, số, dấu chấm, gạch dưới, gạch ngang")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Tài khoản phải từ 3 đến 50 ký tự")]
    [Display(Name = "Tài khoản")]
    public string UserName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập email")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
    [StringLength(100, ErrorMessage = "Email không được vượt quá 100 ký tự")]
    [Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập họ và tên")]
    [RegularExpression(@"^[A-Za-zÀ-ỹà-ỹ\s]+$", ErrorMessage = "Họ và tên chỉ được chứa chữ cái và khoảng trắng")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Họ và tên phải từ 2 đến 100 ký tự")]
    [Display(Name = "Họ và tên")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
    [MinLength(6, ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự")]
    [Display(Name = "Mật khẩu")]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Phòng ban")]
    public int DeptId { get; set; }

    [Display(Name = "Chức vụ")]
    public int PositionId { get; set; }

    [RegularExpression(@"^\d{10,11}$", ErrorMessage = "Số điện thoại phải gồm 10 hoặc 11 chữ số")]
    [Display(Name = "Điện thoại")]
    public string? Phone { get; set; }

    public List<int> RoleIds { get; set; } = new();
}

public class UpdateUserRequest
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập email")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
    [StringLength(100, ErrorMessage = "Email không được vượt quá 100 ký tự")]
    [Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập họ và tên")]
    [RegularExpression(@"^[A-Za-zÀ-ỹà-ỹ\s]+$", ErrorMessage = "Họ và tên chỉ được chứa chữ cái và khoảng trắng")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Họ và tên phải từ 2 đến 100 ký tự")]
    [Display(Name = "Họ và tên")]
    public string FullName { get; set; } = string.Empty;

    [RegularExpression(@"^\d{10,11}$", ErrorMessage = "Số điện thoại phải gồm 10 hoặc 11 chữ số")]
    [Display(Name = "Điện thoại")]
    public string? Phone { get; set; }

    [Display(Name = "Phòng ban")]
    public int DeptId { get; set; }

    [Display(Name = "Chức vụ (mã)")]
    public int PositionId { get; set; }

    [Display(Name = "Tài khoản hoạt động")]
    public bool IsActive { get; set; } = true;

    public List<int> RoleIds { get; set; } = new();
}

public class AdminResetPasswordRequest
{
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới")]
    [MinLength(6, ErrorMessage = "Mật khẩu mới phải có ít nhất 6 ký tự")]
    [Display(Name = "Mật khẩu mới")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập xác nhận mật khẩu")]
    [Compare(nameof(NewPassword), ErrorMessage = "Xác nhận mật khẩu không khớp")]
    [Display(Name = "Xác nhận mật khẩu")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

