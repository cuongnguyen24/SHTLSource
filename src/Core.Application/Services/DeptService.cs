using Core.Domain.Contracts;
using Core.Domain.Entities.Acc;
using Infrastructure.Data.Repositories.Acc;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IDeptService
{
    Task<IEnumerable<DeptDto>> GetListAsync(int channelId);
    Task<DeptDto?> GetByIdAsync(int id);
    Task<ApiResult<int>> CreateAsync(CreateDeptRequest req, ICurrentUser currentUser);
    Task<ApiResult> UpdateAsync(UpdateDeptRequest req, ICurrentUser currentUser);
    Task<ApiResult> DeleteAsync(int id, int channelId, ICurrentUser currentUser);
}

public class DeptService : IDeptService
{
    private readonly IDeptRepository _deptRepo;

    public DeptService(IDeptRepository deptRepo)
    {
        _deptRepo = deptRepo;
    }

    public async Task<IEnumerable<DeptDto>> GetListAsync(int channelId)
    {
        var list = await _deptRepo.GetByChannelAsync(channelId);
        return list.Select(MapToDto);
    }

    public async Task<DeptDto?> GetByIdAsync(int id)
    {
        var d = await _deptRepo.GetByIdAsync(id);
        return d is null ? null : MapToDto(d);
    }

    public async Task<ApiResult<int>> CreateAsync(CreateDeptRequest req, ICurrentUser currentUser)
    {
        var dept = new Dept
        {
            ChannelId = req.ChannelId != 0 ? req.ChannelId : currentUser.ChannelId,
            Name = req.Name.Trim(),
            Code = req.Code?.Trim().ToUpper() ?? string.Empty,
            Parent = req.ParentId ?? 0,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id
        };

        var id = (int)await _deptRepo.InsertAsync(dept);
        return ApiResult<int>.Ok(id, "Tạo phòng ban thành công");
    }

    public async Task<ApiResult> UpdateAsync(UpdateDeptRequest req, ICurrentUser currentUser)
    {
        var dept = await _deptRepo.GetByIdAsync(req.Id);
        if (dept is null) return ApiResult.Fail("Phòng ban không tồn tại");

        dept.Name = req.Name.Trim();
        dept.Code = req.Code?.Trim().ToUpper() ?? dept.Code;
        dept.Parent = req.ParentId ?? 0;
        dept.Updated = DateTime.UtcNow;
        dept.UpdatedBy = currentUser.Id;

        await _deptRepo.UpdateAsync(dept);
        return ApiResult.Ok("Cập nhật phòng ban thành công");
    }

    public async Task<ApiResult> DeleteAsync(int id, int channelId, ICurrentUser currentUser)
    {
        var dept = await _deptRepo.GetByIdAsync(id);
        if (dept is null || dept.ChannelId != channelId)
            return ApiResult.Fail("Phòng ban không tồn tại");

        await _deptRepo.DeleteAsync(id);
        return ApiResult.Ok("Đã xóa phòng ban");
    }

    private static DeptDto MapToDto(Dept d) => new()
    {
        Id = d.Id,
        ChannelId = d.ChannelId,
        Name = d.Name,
        Code = d.Code ?? string.Empty,
        ParentId = d.Parent > 0 ? d.Parent : null
    };
}
