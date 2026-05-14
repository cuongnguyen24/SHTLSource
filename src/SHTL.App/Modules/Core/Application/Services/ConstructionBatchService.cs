using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IConstructionBatchService
{
    Task<ConstructionDashboardViewModel> GetDashboardAsync();
    Task<IReadOnlyList<ConstructionBatchListItemDto>> GetBatchesAsync(string? search, bool onlyMine, ICurrentUser currentUser);
    Task<ConstructionBatchDetailsDto?> GetBatchDetailsAsync(long batchId);
    Task<ApiResult<long>> CreateBatchAsync(ConstructionCreateBatchRequest request, ICurrentUser currentUser);
    Task<ApiResult> AssignBatchAsync(ConstructionAssignBatchRequest request, ICurrentUser currentUser);
    Task<ApiResult> UpdateBatchStatusAsync(long batchId, ConstructionBatchStatus status, ICurrentUser currentUser);
}

public sealed class ConstructionBatchService : IConstructionBatchService
{
    private readonly IConstructionBatchRepository _repo;
    private readonly IUserRepository _users;

    public ConstructionBatchService(IConstructionBatchRepository repo, IUserRepository users)
    {
        _repo = repo;
        _users = users;
    }

    public Task<ConstructionDashboardViewModel> GetDashboardAsync()
        => _repo.GetDashboardAsync();

    public Task<IReadOnlyList<ConstructionBatchListItemDto>> GetBatchesAsync(string? search, bool onlyMine, ICurrentUser currentUser)
        => _repo.GetBatchListAsync(search, onlyMine && !currentUser.IsAdmin, currentUser.Id);

    public async Task<ConstructionBatchDetailsDto?> GetBatchDetailsAsync(long batchId)
    {
        var batch = await _repo.GetBatchByIdAsync(batchId);
        if (batch is null) return null;

        var batchList = await _repo.GetBatchListAsync(null, false, 0, 1000);
        var row = batchList.FirstOrDefault(x => x.Id == batchId);
        if (row is null) return null;

        return new ConstructionBatchDetailsDto
        {
            Batch = row,
            Assignments = await _repo.GetBatchAssignmentsAsync(batchId),
            StepProgress = await _repo.GetBatchStepProgressAsync(batchId)
        };
    }

    public async Task<ApiResult<long>> CreateBatchAsync(ConstructionCreateBatchRequest request, ICurrentUser currentUser)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return ApiResult<long>.Fail("Tên bộ hồ sơ không được để trống.");

        var code = "BATCH-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var batch = new ConstructionBatch
        {
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            FolderId = request.FolderId,
            Status = ConstructionBatchStatus.Active,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id,
            Updated = null,
            UpdatedBy = 0,
            DueAt = request.DueAt
        };

        var batchId = await _repo.CreateBatchAsync(batch);
        if (request.FolderId.HasValue && request.FolderId.Value > 0)
        {
            await _repo.PopulateBatchDocumentsFromFolderAsync(batchId, request.FolderId.Value, currentUser.Id);
        }

        return ApiResult<long>.Ok(batchId, "Đã tạo bộ hồ sơ.");
    }

    public async Task<ApiResult> AssignBatchAsync(ConstructionAssignBatchRequest request, ICurrentUser currentUser)
    {
        if (request.BatchId <= 0)
            return ApiResult.Fail("Bộ hồ sơ không hợp lệ.");
        if (request.Items == null || request.Items.Count == 0)
            return ApiResult.Fail("Bạn chưa chọn người xử lý.");

        var batch = await _repo.GetBatchByIdAsync(request.BatchId);
        if (batch is null)
            return ApiResult.Fail("Bộ hồ sơ không tồn tại.");

        var activeUsers = (await _users.GetActiveUsersAsync()).ToDictionary(x => x.Id);
        var now = DateTime.UtcNow;
        var deduped = request.Items
            .Where(x => x.UserId > 0)
            .GroupBy(x => new { x.UserId, x.Step })
            .Select(g => g.First())
            .ToList();
        if (deduped.Count == 0)
            return ApiResult.Fail("Danh sách phân công rỗng.");

        foreach (var item in deduped)
        {
            if (!activeUsers.ContainsKey(item.UserId))
                return ApiResult.Fail($"Người dùng #{item.UserId} không tồn tại hoặc đã ngưng hoạt động.");
        }

        var assignments = deduped.Select(x => new ConstructionBatchAssignment
        {
            BatchId = request.BatchId,
            UserId = x.UserId,
            Step = x.Step,
            Status = ConstructionAssignmentStatus.Active,
            AssignedAt = now,
            AssignedBy = currentUser.Id,
            Created = now,
            CreatedBy = currentUser.Id
        }).ToList();

        await _repo.ReplaceBatchAssignmentsAsync(request.BatchId, assignments, currentUser.Id);
        await _repo.LinkDocumentsToAssigneesByStepAsync(request.BatchId);
        await _repo.UpdateBatchStatusAsync(request.BatchId, ConstructionBatchStatus.InProgress, currentUser.Id);
        return ApiResult.Ok("Đã phân công bộ hồ sơ.");
    }

    public async Task<ApiResult> UpdateBatchStatusAsync(long batchId, ConstructionBatchStatus status, ICurrentUser currentUser)
    {
        var batch = await _repo.GetBatchByIdAsync(batchId);
        if (batch is null)
            return ApiResult.Fail("Bộ hồ sơ không tồn tại.");
        await _repo.UpdateBatchStatusAsync(batchId, status, currentUser.Id);
        return ApiResult.Ok("Đã cập nhật trạng thái.");
    }
}
