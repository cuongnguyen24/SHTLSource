using Dapper;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IConstructionBatchRepository
{
    Task<long> CreateBatchAsync(ConstructionBatch batch);
    Task<int> UpdateBatchStatusAsync(long batchId, ConstructionBatchStatus status, int updatedBy);
    Task<ConstructionBatch?> GetBatchByIdAsync(long batchId);
    Task<IReadOnlyList<ConstructionBatchListItemDto>> GetBatchListAsync(string? search, bool onlyMine, int userId, int take = 100);
    Task<IReadOnlyList<ConstructionBatchStepProgressDto>> GetBatchStepProgressAsync(long batchId);
    Task<IReadOnlyList<ConstructionBatchAssignmentDto>> GetBatchAssignmentsAsync(long batchId);
    Task<long> AssignUserStepAsync(ConstructionBatchAssignment assignment);
    Task<int> ReplaceBatchAssignmentsAsync(long batchId, IReadOnlyList<ConstructionBatchAssignment> assignments, int updatedBy);
    Task<int> PopulateBatchDocumentsFromFolderAsync(long batchId, long folderId, int createdBy);
    Task<int> LinkDocumentsToAssigneesByStepAsync(long batchId);
    Task<ConstructionDashboardViewModel> GetDashboardAsync();
}

public sealed class ConstructionBatchRepository : BaseRepository, IConstructionBatchRepository
{
    public ConstructionBatchRepository(AppDbContext db) : base(db) { }

    public async Task<long> CreateBatchAsync(ConstructionBatch batch)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
INSERT INTO dbo.stg_construction_batches
    (code, name, [description], folder_id, assigned_to_user_id, assigned_to_dept_id, [status],
     total_documents, started_at, due_at, completed_at, created, created_by, updated, updated_by)
OUTPUT INSERTED.id
VALUES
    (@Code, @Name, @Description, @FolderId, @AssignedToUserId, @AssignedToDeptId, @Status,
     @TotalDocuments, @StartedAt, @DueAt, @CompletedAt, @Created, @CreatedBy, @Updated, @UpdatedBy);";
        return await ExecuteScalarAsync<long>(conn, sql, new
        {
            batch.Code,
            batch.Name,
            Description = batch.Description,
            batch.FolderId,
            batch.AssignedToUserId,
            batch.AssignedToDeptId,
            Status = (byte)batch.Status,
            batch.TotalDocuments,
            batch.StartedAt,
            batch.DueAt,
            batch.CompletedAt,
            batch.Created,
            batch.CreatedBy,
            batch.Updated,
            batch.UpdatedBy
        });
    }

    public async Task<int> UpdateBatchStatusAsync(long batchId, ConstructionBatchStatus status, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
UPDATE dbo.stg_construction_batches
SET [status] = @Status,
    completed_at = CASE WHEN @Status = 3 THEN SYSUTCDATETIME() ELSE completed_at END,
    updated = SYSUTCDATETIME(),
    updated_by = @UpdatedBy
WHERE id = @BatchId;",
            new { BatchId = batchId, Status = (byte)status, UpdatedBy = updatedBy });
    }

    public async Task<ConstructionBatch?> GetBatchByIdAsync(long batchId)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<ConstructionBatch>(conn,
            "SELECT * FROM dbo.stg_construction_batches WHERE id = @BatchId",
            new { BatchId = batchId });
    }

    public async Task<IReadOnlyList<ConstructionBatchListItemDto>> GetBatchListAsync(string? search, bool onlyMine, int userId, int take = 100)
    {
        var conn = await OpenConnectionAsync();
        var p = new DynamicParameters();
        p.Add("Take", Math.Clamp(take, 1, 500));
        p.Add("Search", string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%");
        p.Add("UserId", userId);
        p.Add("OnlyMine", onlyMine ? 1 : 0);
        const string sql = @"
WITH cte AS (
    SELECT TOP (@Take)
        b.id,
        b.code,
        b.name,
        b.[description],
        b.[status],
        b.total_documents,
        b.created,
        b.created_by,
        u.user_name AS created_by_name
    FROM dbo.stg_construction_batches b
    LEFT JOIN dbo.acc_users u ON u.id = b.created_by
    WHERE (@Search IS NULL OR b.name LIKE @Search OR b.code LIKE @Search)
      AND (@OnlyMine = 0 OR EXISTS (
            SELECT 1 FROM dbo.stg_construction_batch_assignments a
            WHERE a.batch_id = b.id AND a.user_id = @UserId AND a.[status] = 1
      ))
    ORDER BY b.created DESC, b.id DESC
)
SELECT
    c.id AS Id,
    c.code AS Code,
    c.name AS Name,
    c.[description] AS Description,
    c.[status] AS Status,
    c.total_documents AS TotalDocuments,
    ISNULL((
        SELECT COUNT(1) FROM dbo.stg_construction_batch_documents d
        WHERE d.batch_id = c.id AND d.[status] = 2
    ), 0) AS CompletedDocuments,
    ISNULL((
        SELECT COUNT(DISTINCT a.user_id) FROM dbo.stg_construction_batch_assignments a
        WHERE a.batch_id = c.id AND a.[status] = 1
    ), 0) AS AssignedUsers,
    c.created AS Created,
    ISNULL(c.created_by_name, N'') AS CreatedByName
FROM cte c
ORDER BY c.created DESC, c.id DESC;";
        var rows = await QueryAsync<ConstructionBatchListItemDto>(conn, sql, p);
        return rows.ToList();
    }

    public async Task<IReadOnlyList<ConstructionBatchStepProgressDto>> GetBatchStepProgressAsync(long batchId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT
    d.current_step AS Step,
    COUNT(1) AS Total,
    SUM(CASE WHEN d.[status] = 0 THEN 1 ELSE 0 END) AS Pending,
    SUM(CASE WHEN d.[status] = 1 THEN 1 ELSE 0 END) AS InProgress,
    SUM(CASE WHEN d.[status] = 2 THEN 1 ELSE 0 END) AS Done,
    SUM(CASE WHEN d.[status] = 3 THEN 1 ELSE 0 END) AS Returned,
    SUM(CASE WHEN d.[status] = 4 THEN 1 ELSE 0 END) AS Failed,
    CAST(
        CASE WHEN COUNT(1) = 0 THEN 0
             ELSE (SUM(CASE WHEN d.[status] = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(1))
        END AS decimal(18,2)) AS CompletionPercent
FROM dbo.stg_construction_batch_documents d
WHERE d.batch_id = @BatchId
GROUP BY d.current_step
ORDER BY d.current_step;";
        var rows = await QueryAsync<ConstructionBatchStepProgressDto>(conn, sql, new { BatchId = batchId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<ConstructionBatchAssignmentDto>> GetBatchAssignmentsAsync(long batchId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT
    a.id AS Id,
    a.user_id AS UserId,
    ISNULL(u.user_name, N'') AS UserName,
    ISNULL(u.full_name, N'') AS FullName,
    a.step AS Step,
    a.[status] AS Status,
    a.assigned_at AS AssignedAt
FROM dbo.stg_construction_batch_assignments a
LEFT JOIN dbo.acc_users u ON u.id = a.user_id
WHERE a.batch_id = @BatchId
ORDER BY a.step, u.full_name, u.user_name;";
        var rows = await QueryAsync<ConstructionBatchAssignmentDto>(conn, sql, new { BatchId = batchId });
        return rows.ToList();
    }

    public async Task<long> AssignUserStepAsync(ConstructionBatchAssignment assignment)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
INSERT INTO dbo.stg_construction_batch_assignments
    (batch_id, user_id, step, [status], assigned_at, assigned_by, completed_at, created, created_by, updated, updated_by)
OUTPUT INSERTED.id
VALUES
    (@BatchId, @UserId, @Step, @Status, @AssignedAt, @AssignedBy, @CompletedAt, @Created, @CreatedBy, @Updated, @UpdatedBy);";
        return await ExecuteScalarAsync<long>(conn, sql, new
        {
            assignment.BatchId,
            assignment.UserId,
            Step = (byte)assignment.Step,
            Status = (byte)assignment.Status,
            assignment.AssignedAt,
            assignment.AssignedBy,
            assignment.CompletedAt,
            assignment.Created,
            assignment.CreatedBy,
            assignment.Updated,
            assignment.UpdatedBy
        });
    }

    public async Task<int> ReplaceBatchAssignmentsAsync(long batchId, IReadOnlyList<ConstructionBatchAssignment> assignments, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            await ExecuteAsync(conn, @"
UPDATE dbo.stg_construction_batch_assignments
SET [status] = 3, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy
WHERE batch_id = @BatchId AND [status] = 1;", new { BatchId = batchId, UpdatedBy = updatedBy }, tx);

            foreach (var item in assignments)
            {
                await ExecuteAsync(conn, @"
INSERT INTO dbo.stg_construction_batch_assignments
    (batch_id, user_id, step, [status], assigned_at, assigned_by, created, created_by, updated, updated_by)
VALUES
    (@BatchId, @UserId, @Step, 1, @AssignedAt, @AssignedBy, @Created, @CreatedBy, @Updated, @UpdatedBy);", new
                {
                    item.BatchId,
                    item.UserId,
                    Step = (byte)item.Step,
                    item.AssignedAt,
                    item.AssignedBy,
                    item.Created,
                    item.CreatedBy,
                    item.Updated,
                    item.UpdatedBy
                }, tx);
            }

            await tx.CommitAsync();
            return assignments.Count;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task<int> PopulateBatchDocumentsFromFolderAsync(long batchId, long folderId, int createdBy)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
INSERT INTO dbo.stg_construction_batch_documents
    (batch_id, document_id, assignment_id, current_step, [status], is_owned_by_uploader, started_at, completed_at, created, created_by, updated, updated_by)
SELECT
    @BatchId,
    d.id,
    NULL,
    d.current_step,
    0,
    0,
    NULL,
    NULL,
    SYSUTCDATETIME(),
    @CreatedBy,
    NULL,
    0
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.folder_id = @FolderId
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.stg_construction_batch_documents x
      WHERE x.batch_id = @BatchId
        AND x.document_id = d.id
  );";
        return await ExecuteAsync(conn, sql, new { BatchId = batchId, FolderId = folderId, CreatedBy = createdBy });
    }

    public async Task<int> LinkDocumentsToAssigneesByStepAsync(long batchId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
UPDATE d
SET assignment_id = a.id,
    updated = SYSUTCDATETIME(),
    updated_by = a.assigned_by
FROM dbo.stg_construction_batch_documents d
INNER JOIN dbo.stg_construction_batch_assignments a
    ON a.batch_id = d.batch_id
   AND a.step = d.current_step
   AND a.[status] = 1
WHERE d.batch_id = @BatchId;";
        return await ExecuteAsync(conn, sql, new { BatchId = batchId });
    }

    public async Task<ConstructionDashboardViewModel> GetDashboardAsync()
    {
        var conn = await OpenConnectionAsync();
        var vm = new ConstructionDashboardViewModel();

        var agg = await QueryFirstOrDefaultAsync<DashboardAgg>(conn, @"
SELECT
    COUNT(1) AS TotalBatches,
    SUM(CASE WHEN [status] IN (1,2) THEN 1 ELSE 0 END) AS ActiveBatches,
    SUM(CASE WHEN [status] = 3 THEN 1 ELSE 0 END) AS CompletedBatches,
    SUM(ISNULL(total_documents, 0)) AS TotalDocuments
FROM dbo.stg_construction_batches;");

        var doneDocs = await ExecuteScalarAsync<int>(conn, @"
SELECT COUNT(1)
FROM dbo.stg_construction_batch_documents
WHERE [status] = 2;");

        vm.TotalBatches = agg?.TotalBatches ?? 0;
        vm.ActiveBatches = agg?.ActiveBatches ?? 0;
        vm.CompletedBatches = agg?.CompletedBatches ?? 0;
        vm.TotalDocuments = agg?.TotalDocuments ?? 0;
        vm.CompletedDocuments = doneDocs;
        vm.CompletionPercent = vm.TotalDocuments <= 0
            ? 0
            : Math.Round(vm.CompletedDocuments * 100m / vm.TotalDocuments, 2);
        vm.LatestBatches = await GetBatchListAsync(null, false, 0, 8);
        return vm;
    }

    private sealed class DashboardAgg
    {
        public int TotalBatches { get; set; }
        public int ActiveBatches { get; set; }
        public int CompletedBatches { get; set; }
        public int TotalDocuments { get; set; }
    }
}
