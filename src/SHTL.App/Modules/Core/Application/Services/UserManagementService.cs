using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IUserManagementService
{
    Task<PaginatedResult<UserDto>> GetListAsync(int pageIndex, int pageSize, string? search);
    Task<UserDto?> GetByIdAsync(int id);
    Task<List<int>> GetUserRoleIdsAsync(int userId);
    Task<ApiResult<int>> CreateAsync(CreateUserRequest req, ICurrentUser currentUser);
    Task<ApiResult> UpdateAsync(UpdateUserRequest req, ICurrentUser currentUser);
    Task<ApiResult> SetActiveAsync(int id, bool isActive, ICurrentUser currentUser);
    Task<ApiResult> AdminResetPasswordAsync(int userId, AdminResetPasswordRequest req, ICurrentUser currentUser);
    Task<ApiResult> ChangePasswordAsync(int userId, ChangePasswordRequest req);
}

public class UserManagementService : IUserManagementService
{
    private readonly IUserRepository _userRepo;
    private readonly IPasswordHasher _hasher;
    private readonly ILogger<UserManagementService> _logger;

    public UserManagementService(
        IUserRepository userRepo,
        IPasswordHasher hasher,
        ILogger<UserManagementService> logger)
    {
        _userRepo = userRepo;
        _hasher = hasher;
        _logger = logger;
    }

    public async Task<PaginatedResult<UserDto>> GetListAsync(int pageIndex, int pageSize, string? search)
    {
        var items = (await _userRepo.GetListAsync(pageIndex, pageSize, search)).ToList();
        var count = await _userRepo.CountAsync(search);

        var deptMap = await _userRepo.GetDeptNameMapAsync(items.Select(u => u.DeptId));
        var roleMap = await _userRepo.GetRoleNamesByUserIdsAsync(items.Select(u => u.Id));

        var dtos = items.Select(u =>
        {
            var dto = MapToDto(u);
            dto.DeptName = u.DeptId > 0 ? (deptMap.TryGetValue(u.DeptId, out var dn) ? dn : null) : null;
            dto.Roles = roleMap.TryGetValue(u.Id, out var roles) ? roles : new List<string>();
            return dto;
        });

        return new PaginatedResult<UserDto>
        {
            Items = dtos,
            TotalCount = count,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    public async Task<UserDto?> GetByIdAsync(int id)
    {
        var user = await _userRepo.GetByIdAsync(id);
        return user is null ? null : MapToDto(user);
    }

    public Task<List<int>> GetUserRoleIdsAsync(int userId)
        => _userRepo.GetRoleIdsForUserAsync(userId);

    public async Task<ApiResult<int>> CreateAsync(CreateUserRequest req, ICurrentUser currentUser)
    {
        var existing = await _userRepo.GetByUserNameAsync(req.UserName);
        if (existing is not null)
            return ApiResult<int>.Fail("Tên đăng nhập đã tồn tại");

        var user = new User
        {
            UserName = req.UserName.Trim().ToLower(),
            Email = req.Email.Trim().ToLower(),
            FullName = req.FullName.Trim(),
            PasswordHash = _hasher.Hash(req.Password),
            PasswordSalt = string.Empty,
            DeptId = req.DeptId,
            PositionId = req.PositionId,
            IsActive = true,
            IsAdmin = false,
            Phone = req.Phone,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id,
            SearchMeta = $"{req.FullName} {req.UserName} {req.Email}"
        };

        var id = await _userRepo.InsertAsync(user);

        if (req.RoleIds.Count > 0)
            await _userRepo.SaveUserRolesAsync(id, req.RoleIds);

        return ApiResult<int>.Ok(id, "Tạo người dùng thành công");
    }

    public async Task<ApiResult> UpdateAsync(UpdateUserRequest req, ICurrentUser currentUser)
    {
        var user = await _userRepo.GetByIdAsync(req.Id);
        if (user is null)
            return ApiResult.Fail("Không tìm thấy người dùng");

        if (req.Id == currentUser.Id && !req.IsActive)
            return ApiResult.Fail("Không thể vô hiệu hóa chính bạn");

        var email = req.Email.Trim().ToLower();
        var existingEmail = await _userRepo.GetByEmailAsync(email);
        if (existingEmail is not null && existingEmail.Id != req.Id)
            return ApiResult.Fail("Email đã được sử dụng bởi tài khoản khác");

        user.Email = email;
        user.FullName = req.FullName.Trim();
        user.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        user.DeptId = req.DeptId;
        user.PositionId = req.PositionId;
        user.IsActive = req.IsActive;
        user.SearchMeta = $"{user.FullName} {user.UserName} {user.Email}";
        user.Updated = DateTime.UtcNow;
        user.UpdatedBy = currentUser.Id;

        await _userRepo.UpdateAsync(user);
        await _userRepo.SaveUserRolesAsync(req.Id, req.RoleIds);
        return ApiResult.Ok("Cập nhật người dùng thành công");
    }

    public async Task<ApiResult> SetActiveAsync(int id, bool isActive, ICurrentUser currentUser)
    {
        if (id == currentUser.Id && !isActive)
            return ApiResult.Fail("Không thể vô hiệu hóa chính bạn");

        await _userRepo.SetActiveAsync(id, isActive, currentUser.Id);
        return ApiResult.Ok(isActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản");
    }

    public async Task<ApiResult> AdminResetPasswordAsync(int userId, AdminResetPasswordRequest req, ICurrentUser currentUser)
    {
        if (req.NewPassword != req.ConfirmPassword)
            return ApiResult.Fail("Mật khẩu xác nhận không khớp");

        var user = await _userRepo.GetByIdAsync(userId);
        if (user is null)
            return ApiResult.Fail("Người dùng không tồn tại");

        await _userRepo.SetPasswordHashAsync(userId, _hasher.Hash(req.NewPassword), currentUser.Id);
        return ApiResult.Ok("Đặt lại mật khẩu thành công");
    }

    public async Task<ApiResult> ChangePasswordAsync(int userId, ChangePasswordRequest req)
    {
        if (req.NewPassword != req.ConfirmPassword)
            return ApiResult.Fail("Mật khẩu xác nhận không khớp");

        var user = await _userRepo.GetByIdAsync(userId);
        if (user is null) return ApiResult.Fail("Người dùng không tồn tại");

        if (!_hasher.Verify(req.CurrentPassword, user.PasswordHash))
            return ApiResult.Fail("Mật khẩu hiện tại không chính xác");

        user.PasswordHash = _hasher.Hash(req.NewPassword);
        user.Updated = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);

        return ApiResult.Ok("Đổi mật khẩu thành công");
    }

    private static UserDto MapToDto(User u) => new()
    {
        Id = u.Id,
        UserName = u.UserName,
        Email = u.Email,
        FullName = u.FullName,
        DeptId = u.DeptId,
        PositionId = u.PositionId,
        IsActive = u.IsActive,
        IsAdmin = u.IsAdmin,
        Avatar = u.Avatar,
        Phone = u.Phone,
        LastLogin = u.LastLogin
    };
}
