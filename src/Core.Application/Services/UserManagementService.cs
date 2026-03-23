using Core.Domain.Contracts;
using Core.Domain.Entities.Acc;
using Infrastructure.Data.Repositories.Acc;
using Infrastructure.Identity;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IUserManagementService
{
    Task<PaginatedResult<UserDto>> GetListAsync(int channelId, int pageIndex, int pageSize, string? search);
    Task<UserDto?> GetByIdAsync(int id);
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

    public UserManagementService(IUserRepository userRepo, IPasswordHasher hasher)
    {
        _userRepo = userRepo;
        _hasher = hasher;
    }

    public async Task<PaginatedResult<UserDto>> GetListAsync(int channelId, int pageIndex, int pageSize, string? search)
    {
        var items = await _userRepo.GetListAsync(channelId, pageIndex, pageSize, search);
        var count = await _userRepo.CountAsync(channelId, search);

        return new PaginatedResult<UserDto>
        {
            Items = items.Select(MapToDto),
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

    public async Task<ApiResult<int>> CreateAsync(CreateUserRequest req, ICurrentUser currentUser)
    {
        var existing = await _userRepo.GetByUserNameAsync(req.UserName);
        if (existing is not null)
            return ApiResult<int>.Fail("Tên đăng nhập đã tồn tại");

        var user = new User
        {
            ChannelId = req.ChannelId != 0 ? req.ChannelId : currentUser.ChannelId,
            UserName = req.UserName.Trim().ToLower(),
            Email = req.Email.Trim().ToLower(),
            FullName = req.FullName.Trim(),
            PasswordHash = _hasher.Hash(req.Password),
            PasswordSalt = string.Empty,
            DeptId = req.DeptId,
            PositionId = req.PositionId,
            IsActive = true,
            IsAdmin = req.IsAdmin && currentUser.IsAdmin, // Chỉ admin mới tạo admin
            Phone = req.Phone,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id,
            SearchMeta = $"{req.FullName} {req.UserName} {req.Email}"
        };

        var id = await _userRepo.InsertAsync(user);
        return ApiResult<int>.Ok(id, "Tạo người dùng thành công");
    }

    public async Task<ApiResult> UpdateAsync(UpdateUserRequest req, ICurrentUser currentUser)
    {
        var user = await _userRepo.GetByIdAsync(req.Id);
        if (user is null)
            return ApiResult.Fail("Không tìm thấy người dùng");
        if (user.ChannelId != currentUser.ChannelId)
            return ApiResult.Fail("Không được phép thao tác người dùng này");

        if (req.Id == currentUser.Id)
        {
            if (currentUser.IsAdmin && !req.IsAdmin)
                return ApiResult.Fail("Không thể bỏ quyền quản trị của chính bạn");
            if (!req.IsActive)
                return ApiResult.Fail("Không thể vô hiệu hóa chính bạn");
        }

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
        user.IsAdmin = req.IsAdmin && currentUser.IsAdmin;
        user.SearchMeta = $"{user.FullName} {user.UserName} {user.Email}";
        user.Updated = DateTime.UtcNow;
        user.UpdatedBy = currentUser.Id;

        await _userRepo.UpdateAsync(user);
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
        if (user.ChannelId != currentUser.ChannelId)
            return ApiResult.Fail("Không được phép thao tác người dùng này");

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
        ChannelId = u.ChannelId,
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
