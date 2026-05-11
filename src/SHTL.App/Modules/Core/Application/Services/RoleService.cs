using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleDto>> GetListAsync();
    Task<RoleDto?> GetByIdAsync(int id);
    Task<ApiResult> UpdateAsync(EditRoleRequest req, ICurrentUser currentUser);
    Task<ApiResult> SavePermissionsAsync(int roleId, List<string> permissions, ICurrentUser currentUser);
}

public class RoleService : IRoleService
{
    private readonly IRoleRepository _roleRepo;

    public RoleService(IRoleRepository roleRepo)
    {
        _roleRepo = roleRepo;
    }

    public async Task<IEnumerable<RoleDto>> GetListAsync()
    {
        var list = await _roleRepo.GetAllAsync();
        return list.Select(r => new RoleDto
        {
            Id = r.Id,
            Name = r.Name,
            Code = r.Code,
            Description = r.Description
        });
    }

    public async Task<RoleDto?> GetByIdAsync(int id)
    {
        var r = await _roleRepo.GetByIdAsync(id);
        if (r is null) return null;
        return new RoleDto
        {
            Id = r.Id,
            Name = r.Name,
            Code = r.Code,
            Description = r.Description
        };
    }

    public async Task<ApiResult> UpdateAsync(EditRoleRequest req, ICurrentUser currentUser)
    {
        var role = await _roleRepo.GetByIdAsync(req.Id);
        if (role is null)
            return ApiResult.Fail("Vai trò không tồn tại");

        // Cố ý KHÔNG đụng vào Code — vai trò là dữ liệu hạt giống, mã cố định.
        role.Name = (req.Name ?? string.Empty).Trim();
        role.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        role.Updated = DateTime.UtcNow;
        role.UpdatedBy = currentUser.Id;

        var affected = await _roleRepo.UpdateAsync(role);
        if (affected <= 0)
            return ApiResult.Fail("Không cập nhật được vai trò");

        return ApiResult.Ok("Cập nhật vai trò thành công");
    }

    public async Task<ApiResult> SavePermissionsAsync(int roleId, List<string> permissions, ICurrentUser currentUser)
    {
        await _roleRepo.SavePermissionsAsync(roleId, permissions);
        return ApiResult.Ok("Đã lưu danh sách quyền");
    }
}
