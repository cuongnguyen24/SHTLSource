using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleDto>> GetListAsync();
    Task<ApiResult<int>> CreateAsync(CreateRoleRequest req, ICurrentUser currentUser);
    Task<ApiResult> DeleteAsync(int id, ICurrentUser currentUser);
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

    public async Task<ApiResult<int>> CreateAsync(CreateRoleRequest req, ICurrentUser currentUser)
    {
        var existing = await _roleRepo.GetByCodeAsync(req.Code);
        if (existing is not null)
            return ApiResult<int>.Fail("Mã quyền đã tồn tại");

        var role = new Role
        {
            Name = req.Name.Trim(),
            Code = req.Code.Trim().ToUpper(),
            Description = req.Description,
            IsActive = true,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id
        };

        var id = (int)await _roleRepo.InsertAsync(role);
        return ApiResult<int>.Ok(id, "Tạo quyền thành công");
    }

    public async Task<ApiResult> DeleteAsync(int id, ICurrentUser currentUser)
    {
        var role = await _roleRepo.GetByIdAsync(id);
        if (role is null)
            return ApiResult.Fail("Quyền không tồn tại");

        await _roleRepo.DeleteAsync(id);
        return ApiResult.Ok("Đã xóa quyền");
    }

    public async Task<ApiResult> SavePermissionsAsync(int roleId, List<string> permissions, ICurrentUser currentUser)
    {
        await _roleRepo.SavePermissionsAsync(roleId, permissions);
        return ApiResult.Ok("Đã lưu danh sách quyền");
    }
}
