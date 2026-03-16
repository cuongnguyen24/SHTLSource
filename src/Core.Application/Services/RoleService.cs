using Core.Domain.Contracts;
using Core.Domain.Entities.Acc;
using Infrastructure.Data.Repositories.Acc;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleDto>> GetListAsync(int channelId);
    Task<ApiResult<int>> CreateAsync(CreateRoleRequest req, ICurrentUser currentUser);
    Task<ApiResult> DeleteAsync(int id, int channelId, ICurrentUser currentUser);
    Task<ApiResult> SavePermissionsAsync(int roleId, List<string> permissions, int channelId, ICurrentUser currentUser);
}

public class RoleService : IRoleService
{
    private readonly IRoleRepository _roleRepo;

    public RoleService(IRoleRepository roleRepo)
    {
        _roleRepo = roleRepo;
    }

    public async Task<IEnumerable<RoleDto>> GetListAsync(int channelId)
    {
        var list = await _roleRepo.GetByChannelAsync(channelId);
        return list.Select(r => new RoleDto
        {
            Id = r.Id,
            ChannelId = r.ChannelId,
            Name = r.Name,
            Code = r.Code,
            Description = r.Description
        });
    }

    public async Task<ApiResult<int>> CreateAsync(CreateRoleRequest req, ICurrentUser currentUser)
    {
        var existing = await _roleRepo.GetByCodeAsync(req.Code, req.ChannelId);
        if (existing is not null)
            return ApiResult<int>.Fail("Mã quyền đã tồn tại");

        var role = new Role
        {
            ChannelId = req.ChannelId != 0 ? req.ChannelId : currentUser.ChannelId,
            Name = req.Name.Trim(),
            Code = req.Code.Trim().ToUpper(),
            Description = req.Description,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id
        };

        var id = (int)await _roleRepo.InsertAsync(role);
        return ApiResult<int>.Ok(id, "Tạo quyền thành công");
    }

    public async Task<ApiResult> DeleteAsync(int id, int channelId, ICurrentUser currentUser)
    {
        var role = await _roleRepo.GetByIdAsync(id);
        if (role is null || role.ChannelId != channelId)
            return ApiResult.Fail("Quyền không tồn tại");

        await _roleRepo.DeleteAsync(id);
        return ApiResult.Ok("Đã xóa quyền");
    }

    public async Task<ApiResult> SavePermissionsAsync(int roleId, List<string> permissions, int channelId, ICurrentUser currentUser)
    {
        await _roleRepo.SavePermissionsAsync(roleId, permissions, channelId);
        return ApiResult.Ok("Đã lưu danh sách quyền");
    }
}
