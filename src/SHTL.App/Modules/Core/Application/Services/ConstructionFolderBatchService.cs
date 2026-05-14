using Dapper;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IConstructionFolderBatchService
{
    Task<ConstructionFolderBatchPageViewModel> GetFolderPageAsync(string? folderPath, string? filter);
    Task<ConstructionDistributeFormsDialogViewModel> GetDistributeDialogAsync(string folderPath, WorkflowStep step, ICurrentUser currentUser);
    Task<ApiResult<int>> DistributeFormsAsync(ConstructionDistributeFormsRequest request, ICurrentUser currentUser);
    Task<ApiResult<int>> ReclaimFormsAsync(string folderPath, WorkflowStep step, ICurrentUser currentUser);
}

public sealed class ConstructionFolderBatchService : IConstructionFolderBatchService
{
    private readonly AppDbContext _db;
    private readonly IUserRepository _users;
    private readonly IDeptRepository _depts;
    private readonly IAxeSyncTypeRepository _syncTypes;
    private readonly StorageOptions _storageOptions;

    public ConstructionFolderBatchService(
        AppDbContext db,
        IUserRepository users,
        IDeptRepository depts,
        IAxeSyncTypeRepository syncTypes,
        IOptions<StorageOptions> storageOptions)
    {
        _db = db;
        _users = users;
        _depts = depts;
        _syncTypes = syncTypes;
        _storageOptions = storageOptions.Value;
    }

    public async Task<ConstructionFolderBatchPageViewModel> GetFolderPageAsync(string? folderPath, string? filter)
    {
        var parentPath = NormalizeFolderPath(folderPath);
        var term = (filter ?? string.Empty).Trim();
        var parentDepth = string.IsNullOrEmpty(parentPath)
            ? 0
            : parentPath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length;
        var syncFormats = (await _syncTypes.ListAsync(null))
            .Select(x => x.Format)
            .ToList();
        var folderSegmentCount = SyncPathFormatParser.ResolveFolderSegmentCount(syncFormats, parentPath);
        var listFilesAtCurrentLevel = parentDepth >= folderSegmentCount;
        var conn = await _db.GetOpenConnectionAsync();

        var rows = (await conn.QueryAsync<ConstructionFolderBatchRowViewModel>(
            """
            WITH base AS (
                SELECT
                    REPLACE(REPLACE(COALESCE(NULLIF(path_original, N''), NULLIF(file_path, N''), N'Không rõ'), N'\', N'/'), N'//', N'/') AS rel,
                    is_checked_scan1,
                    checked_scan1by,
                    is_checked_scan2,
                    checked_scan2by,
                    is_extracted,
                    extracted_by,
                    is_checked1,
                    checked1by,
                    is_checked2,
                    checked2by,
                    current_step
                FROM dbo.stg_documents
                WHERE status = 1
            ),
            scoped AS (
                SELECT *
                FROM base
                WHERE @ParentPath = N''
                   OR rel = @ParentPath
                   OR rel LIKE @ParentPath + N'/%'
            ),
            child_rows AS (
                SELECT
                    CASE
                        WHEN @ParentPath = N'' THEN
                            CASE
                                WHEN CHARINDEX(N'/', rel) > 0 THEN LEFT(rel, CHARINDEX(N'/', rel) - 1)
                                ELSE rel
                            END
                        WHEN rel = @ParentPath THEN NULL
                        WHEN rel LIKE @ParentPath + N'/%' THEN
                            SUBSTRING(
                                rel,
                                LEN(@ParentPath) + 2,
                                CASE
                                    WHEN CHARINDEX(N'/', SUBSTRING(rel, LEN(@ParentPath) + 2, 4000)) > 0
                                        THEN CHARINDEX(N'/', SUBSTRING(rel, LEN(@ParentPath) + 2, 4000)) - 1
                                    ELSE LEN(SUBSTRING(rel, LEN(@ParentPath) + 2, 4000))
                                END)
                        ELSE NULL
                    END AS child_name,
                    rel,
                    is_checked_scan1,
                    checked_scan1by,
                    is_checked_scan2,
                    checked_scan2by,
                    is_extracted,
                    extracted_by,
                    is_checked1,
                    checked1by,
                    is_checked2,
                    checked2by,
                    current_step
                FROM scoped
            ),
            grouped AS (
                SELECT
                    child_name AS FolderName,
                    CASE
                        WHEN @ParentPath = N'' THEN child_name
                        ELSE @ParentPath + N'/' + child_name
                    END AS FullPath,
                    COUNT(1) AS TotalDocuments,
                    SUM(CASE
                        WHEN checked_scan1by = 0 AND is_checked_scan1 = 0
                             AND current_step IN (1, 2)
                        THEN 1 ELSE 0 END) AS PendingCheckScan1,
                    SUM(CASE
                        WHEN checked_scan2by = 0 AND is_checked_scan2 = 0
                             AND (is_checked_scan1 = 1 OR current_step >= 3)
                        THEN 1 ELSE 0 END) AS PendingCheckScan2,
                    SUM(CASE
                        WHEN extracted_by = 0 AND is_extracted = 0
                             AND current_step IN (6, 7, 8)
                        THEN 1 ELSE 0 END) AS PendingExtract,
                    SUM(CASE
                        WHEN checked1by = 0 AND is_checked1 = 0
                             AND current_step IN (7, 8)
                        THEN 1 ELSE 0 END) AS PendingCheck1,
                    SUM(CASE
                        WHEN checked2by = 0 AND is_checked2 = 0
                             AND current_step IN (8, 9)
                        THEN 1 ELSE 0 END) AS PendingCheck2,
                    SUM(CASE
                        WHEN checked_scan1by > 0 AND is_checked_scan1 = 0
                             AND current_step IN (1, 2)
                        THEN 1 ELSE 0 END) AS InProgressCheckScan1,
                    SUM(CASE
                        WHEN checked_scan2by > 0 AND is_checked_scan2 = 0
                             AND (is_checked_scan1 = 1 OR current_step >= 3)
                        THEN 1 ELSE 0 END) AS InProgressCheckScan2,
                    SUM(CASE
                        WHEN extracted_by > 0 AND is_extracted = 0
                             AND current_step IN (6, 7, 8)
                        THEN 1 ELSE 0 END) AS InProgressExtract,
                    SUM(CASE
                        WHEN checked1by > 0 AND is_checked1 = 0
                             AND current_step IN (7, 8)
                        THEN 1 ELSE 0 END) AS InProgressCheck1,
                    SUM(CASE
                        WHEN checked2by > 0 AND is_checked2 = 0
                             AND current_step IN (8, 9)
                        THEN 1 ELSE 0 END) AS InProgressCheck2,
                    SUM(CASE WHEN is_checked_scan1 = 1 THEN 1 ELSE 0 END) AS CompletedCheckScan1,
                    SUM(CASE WHEN is_checked_scan2 = 1 THEN 1 ELSE 0 END) AS CompletedCheckScan2,
                    SUM(CASE WHEN is_extracted = 1 THEN 1 ELSE 0 END) AS CompletedExtract,
                    SUM(CASE WHEN is_checked1 = 1 THEN 1 ELSE 0 END) AS CompletedCheck1,
                    SUM(CASE WHEN is_checked2 = 1 THEN 1 ELSE 0 END) AS CompletedCheck2
                FROM child_rows
                WHERE child_name IS NOT NULL
                  AND LTRIM(RTRIM(child_name)) <> N''
                GROUP BY child_name
            )
            SELECT
                g.FolderName,
                g.FullPath,
                CASE
                    WHEN @ParentDepth >= @FolderSegmentCount THEN 0
                    WHEN EXISTS (
                        SELECT 1
                        FROM base b
                        WHERE b.rel LIKE g.FullPath + N'/%'
                    ) THEN 1 ELSE 0
                END AS HasChildren,
                g.TotalDocuments,
                g.PendingCheckScan1,
                g.PendingCheckScan2,
                g.PendingExtract,
                g.PendingCheck1,
                g.PendingCheck2,
                g.InProgressCheckScan1,
                g.InProgressCheckScan2,
                g.InProgressExtract,
                g.InProgressCheck1,
                g.InProgressCheck2,
                g.CompletedCheckScan1,
                g.CompletedCheckScan2,
                g.CompletedExtract,
                g.CompletedCheck1,
                g.CompletedCheck2
            FROM grouped g
            WHERE @Filter = N'' OR g.FolderName LIKE N'%' + @Filter + N'%' OR g.FullPath LIKE N'%' + @Filter + N'%'
            ORDER BY g.TotalDocuments DESC, g.FolderName ASC;
            """,
            new
            {
                ParentPath = parentPath,
                Filter = term,
                ParentDepth = parentDepth,
                FolderSegmentCount = folderSegmentCount
            })).ToList();

        var metadataRows = await QueryMetadataFolderRowsAsync(conn, parentPath, parentDepth, term);
        var storageChildren = GetStorageChildNames(parentPath);
        rows = MergeFolderRows(rows, metadataRows, storageChildren, parentPath, parentDepth, folderSegmentCount, listFilesAtCurrentLevel);
        rows = ApplyFolderNavigationRules(rows, parentDepth, folderSegmentCount, listFilesAtCurrentLevel);

        return new ConstructionFolderBatchPageViewModel
        {
            Filter = term,
            CurrentFolderPath = parentPath,
            ParentFolderPath = GetParentFolderPath(parentPath),
            BreadcrumbSegments = BuildBreadcrumb(parentPath),
            GeneratedAtUtc = DateTime.UtcNow,
            Rows = rows
        };
    }

    public async Task<ConstructionDistributeFormsDialogViewModel> GetDistributeDialogAsync(
        string folderPath,
        WorkflowStep step,
        ICurrentUser currentUser)
    {
        var normalizedFolder = NormalizeFolderPath(folderPath);
        if (string.IsNullOrWhiteSpace(normalizedFolder))
            throw new InvalidOperationException("Thư mục không hợp lệ.");

        var available = await CountAvailableAsync(normalizedFolder, step);
        var current = await _users.GetByIdAsync(currentUser.Id);
        var users = (await _users.GetActiveUsersAsync())
            .Select(u => new ConstructionDistributeUserOption
            {
                Id = u.Id,
                UserName = u.UserName,
                FullName = u.FullName,
                DeptId = u.DeptId
            })
            .ToList();

        if (current is not null && !currentUser.IsAdmin)
            users = users.Where(u => u.DeptId == current.DeptId).ToList();

        var depts = (await _depts.GetAllAsync())
            .Select(d => new ConstructionDistributeDeptOption { Id = d.Id, Name = d.Name })
            .ToList();

        return new ConstructionDistributeFormsDialogViewModel
        {
            FolderPath = normalizedFolder,
            Step = step,
            StepLabel = GetStepLabel(step),
            AvailableCount = available,
            Users = users,
            Depts = depts
        };
    }

    public async Task<ApiResult<int>> DistributeFormsAsync(ConstructionDistributeFormsRequest request, ICurrentUser currentUser)
    {
        var folderPath = NormalizeFolderPath(request.FolderPath);
        if (string.IsNullOrWhiteSpace(folderPath))
            return ApiResult<int>.Fail("Thư mục không hợp lệ.");
        if (request.UserId <= 0)
            return ApiResult<int>.Fail("Vui lòng chọn người nhận việc.");
        if (request.Quantity <= 0)
            return ApiResult<int>.Fail("Số lượng phân chia phải lớn hơn 0.");

        var activeUsers = (await _users.GetActiveUsersAsync()).ToDictionary(x => x.Id);
        if (!activeUsers.TryGetValue(request.UserId, out var assignee))
            return ApiResult<int>.Fail("Người dùng không tồn tại hoặc đã ngưng hoạt động.");

        var actor = await _users.GetByIdAsync(currentUser.Id);
        if (actor is not null && !currentUser.IsAdmin && assignee.DeptId != actor.DeptId)
            return ApiResult<int>.Fail("Bạn không thể phân công cho người dùng ngoài phòng ban.");
        if (request.DeptId.HasValue && request.DeptId.Value > 0 && assignee.DeptId != request.DeptId.Value)
            return ApiResult<int>.Fail("Người dùng không thuộc phòng ban đã chọn.");

        var available = await CountAvailableAsync(folderPath, request.Step);
        if (available <= 0)
            return ApiResult<int>.Fail("Không còn phiếu chưa phân trong thư mục này.");
        if (request.Quantity > available)
            return ApiResult<int>.Fail($"Chỉ còn {available} phiếu chưa phân.");

        var affected = await AssignDocumentsAsync(folderPath, request.Step, request.Quantity, request.UserId, currentUser.Id);
        if (affected <= 0)
            return ApiResult<int>.Fail("Không phân được phiếu nào. Vui lòng thử lại.");

        return ApiResult<int>.Ok(affected, $"Đã phân {affected} phiếu cho {assignee.FullName}.");
    }

    public async Task<ApiResult<int>> ReclaimFormsAsync(string folderPath, WorkflowStep step, ICurrentUser currentUser)
    {
        var normalizedFolder = NormalizeFolderPath(folderPath);
        if (string.IsNullOrWhiteSpace(normalizedFolder))
            return ApiResult<int>.Fail("Thư mục không hợp lệ.");

        var inProgress = await CountInProgressAsync(normalizedFolder, step);
        if (inProgress <= 0)
            return ApiResult<int>.Fail("Không có phiếu nào đang được xử lý trong thư mục này.");

        var affected = await ReclaimDocumentsAsync(normalizedFolder, step, currentUser.Id);
        if (affected <= 0)
            return ApiResult<int>.Fail("Không lấy lại được phiếu nào. Vui lòng thử lại.");

        return ApiResult<int>.Ok(affected, $"Đã lấy lại {affected} phiếu về trạng thái chưa phân.");
    }

    private async Task<int> CountAvailableAsync(string folderPath, WorkflowStep step)
    {
        var conn = await _db.GetOpenConnectionAsync();
        var (whereSql, param) = BuildPendingWhere(step);
        param.Add("FolderPath", folderPath);
        var sql = $@"
SELECT COUNT(1)
FROM dbo.stg_documents d
WHERE d.status = 1
  AND ({BuildFolderMatchSql()})
  AND {whereSql};";
        return await conn.ExecuteScalarAsync<int>(sql, param);
    }

    private async Task<int> AssignDocumentsAsync(string folderPath, WorkflowStep step, int quantity, int userId, int assignedBy)
    {
        var conn = await _db.GetOpenConnectionAsync();
        var (whereSql, param) = BuildPendingWhere(step);
        param.Add("FolderPath", folderPath);
        param.Add("Take", quantity);
        param.Add("UserId", userId);
        param.Add("AssignedBy", assignedBy);

        var updateSet = step switch
        {
            WorkflowStep.CheckScan1 => "checked_scan1by = @UserId, checked_scan1at = SYSUTCDATETIME(), locked_by_step = 2, locked_by_user_id = @UserId, locked_at = SYSUTCDATETIME(), updated = SYSUTCDATETIME(), updated_by = @AssignedBy",
            WorkflowStep.CheckScan2 => "checked_scan2by = @UserId, checked_scan2at = SYSUTCDATETIME(), locked_by_step = 3, locked_by_user_id = @UserId, locked_at = SYSUTCDATETIME(), updated = SYSUTCDATETIME(), updated_by = @AssignedBy",
            WorkflowStep.Extract => "extracted_by = @UserId, locked_by_step = 6, locked_by_user_id = @UserId, locked_at = SYSUTCDATETIME(), updated = SYSUTCDATETIME(), updated_by = @AssignedBy",
            WorkflowStep.Check1 => "checked1by = @UserId, locked_by_step = 7, locked_by_user_id = @UserId, locked_at = SYSUTCDATETIME(), updated = SYSUTCDATETIME(), updated_by = @AssignedBy",
            WorkflowStep.Check2 => "checked2by = @UserId, locked_by_step = 8, locked_by_user_id = @UserId, locked_at = SYSUTCDATETIME(), updated = SYSUTCDATETIME(), updated_by = @AssignedBy",
            _ => throw new InvalidOperationException("Bước phân phiếu không hợp lệ.")
        };

        var sql = $@"
UPDATE d
SET {updateSet}
FROM dbo.stg_documents d
INNER JOIN (
    SELECT TOP (@Take) id
    FROM dbo.stg_documents d
    WHERE d.status = 1
      AND ({BuildFolderMatchSql()})
      AND {whereSql}
    ORDER BY id
) x ON x.id = d.id;";

        return await conn.ExecuteAsync(sql, param);
    }

    private async Task<int> CountInProgressAsync(string folderPath, WorkflowStep step)
    {
        var conn = await _db.GetOpenConnectionAsync();
        var (whereSql, param) = BuildInProgressWhere(step);
        param.Add("FolderPath", folderPath);
        var sql = $@"
SELECT COUNT(1)
FROM dbo.stg_documents d
WHERE d.status = 1
  AND ({BuildFolderMatchSql()})
  AND {whereSql};";
        return await conn.ExecuteScalarAsync<int>(sql, param);
    }

    private async Task<int> ReclaimDocumentsAsync(string folderPath, WorkflowStep step, int reclaimedBy)
    {
        var conn = await _db.GetOpenConnectionAsync();
        var (whereSql, param) = BuildInProgressWhere(step);
        param.Add("FolderPath", folderPath);
        param.Add("ReclaimedBy", reclaimedBy);

        var updateSet = step switch
        {
            WorkflowStep.CheckScan1 => "checked_scan1by = 0, checked_scan1at = NULL, locked_by_step = 1, locked_by_user_id = 0, locked_at = NULL, updated = SYSUTCDATETIME(), updated_by = @ReclaimedBy",
            WorkflowStep.CheckScan2 => "checked_scan2by = 0, checked_scan2at = NULL, locked_by_step = 2, locked_by_user_id = 0, locked_at = NULL, updated = SYSUTCDATETIME(), updated_by = @ReclaimedBy",
            WorkflowStep.Extract => "extracted_by = 0, locked_by_step = 5, locked_by_user_id = 0, locked_at = NULL, updated = SYSUTCDATETIME(), updated_by = @ReclaimedBy",
            WorkflowStep.Check1 => "checked1by = 0, locked_by_step = 6, locked_by_user_id = 0, locked_at = NULL, updated = SYSUTCDATETIME(), updated_by = @ReclaimedBy",
            WorkflowStep.Check2 => "checked2by = 0, locked_by_step = 7, locked_by_user_id = 0, locked_at = NULL, updated = SYSUTCDATETIME(), updated_by = @ReclaimedBy",
            _ => throw new InvalidOperationException("Bước phân phiếu không hợp lệ.")
        };

        var sql = $@"
UPDATE d
SET {updateSet}
FROM dbo.stg_documents d
WHERE d.status = 1
  AND ({BuildFolderMatchSql()})
  AND {whereSql};";

        return await conn.ExecuteAsync(sql, param);
    }

    private static (string whereSql, DynamicParameters param) BuildPendingWhere(WorkflowStep step)
    {
        var p = new DynamicParameters();
        var sql = step switch
        {
            WorkflowStep.CheckScan1 => "checked_scan1by = 0 AND is_checked_scan1 = 0 AND current_step IN (1, 2)",
            WorkflowStep.CheckScan2 => "checked_scan2by = 0 AND is_checked_scan2 = 0 AND (is_checked_scan1 = 1 OR current_step >= 3)",
            WorkflowStep.Extract => "extracted_by = 0 AND is_extracted = 0 AND current_step IN (6, 7, 8)",
            WorkflowStep.Check1 => "checked1by = 0 AND is_checked1 = 0 AND current_step IN (7, 8)",
            WorkflowStep.Check2 => "checked2by = 0 AND is_checked2 = 0 AND current_step IN (8, 9)",
            _ => throw new InvalidOperationException("Bước phân phiếu không hợp lệ.")
        };
        return (sql, p);
    }

    private static (string whereSql, DynamicParameters param) BuildInProgressWhere(WorkflowStep step)
    {
        var p = new DynamicParameters();
        var sql = step switch
        {
            WorkflowStep.CheckScan1 => "checked_scan1by > 0 AND is_checked_scan1 = 0 AND current_step IN (1, 2)",
            WorkflowStep.CheckScan2 => "checked_scan2by > 0 AND is_checked_scan2 = 0 AND (is_checked_scan1 = 1 OR current_step >= 3)",
            WorkflowStep.Extract => "extracted_by > 0 AND is_extracted = 0 AND current_step IN (6, 7, 8)",
            WorkflowStep.Check1 => "checked1by > 0 AND is_checked1 = 0 AND current_step IN (7, 8)",
            WorkflowStep.Check2 => "checked2by > 0 AND is_checked2 = 0 AND current_step IN (8, 9)",
            _ => throw new InvalidOperationException("Bước phân phiếu không hợp lệ.")
        };
        return (sql, p);
    }

    private static string BuildFolderMatchSql()
        => """
           REPLACE(REPLACE(COALESCE(NULLIF(d.path_original, N''), NULLIF(d.file_path, N''), N''), N'\', N'/'), N'//', N'/') = @FolderPath
           OR REPLACE(REPLACE(COALESCE(NULLIF(d.path_original, N''), NULLIF(d.file_path, N''), N''), N'\', N'/'), N'//', N'/') LIKE @FolderPath + N'/%'
           """;

    private async Task<List<ConstructionFolderBatchRowViewModel>> QueryMetadataFolderRowsAsync(
        System.Data.Common.DbConnection conn,
        string parentPath,
        int parentDepth,
        string filter)
    {
        if (parentDepth <= 0 || parentDepth > 15)
            return [];

        var fieldColumn = ResolveFolderFieldColumn(parentDepth);
        var parentFieldMatchSql = BuildParentFieldMatchSql(parentPath, parentDepth);
        var sql = $@"
SELECT
    child_name AS FolderName,
    CASE
        WHEN @ParentPath = N'' THEN child_name
        ELSE @ParentPath + N'/' + child_name
    END AS FullPath,
    COUNT(1) AS TotalDocuments,
    SUM(CASE
        WHEN checked_scan1by = 0 AND is_checked_scan1 = 0
             AND current_step IN (1, 2)
        THEN 1 ELSE 0 END) AS PendingCheckScan1,
    SUM(CASE
        WHEN checked_scan2by = 0 AND is_checked_scan2 = 0
             AND (is_checked_scan1 = 1 OR current_step >= 3)
        THEN 1 ELSE 0 END) AS PendingCheckScan2,
    SUM(CASE
        WHEN extracted_by = 0 AND is_extracted = 0
             AND current_step IN (6, 7, 8)
        THEN 1 ELSE 0 END) AS PendingExtract,
    SUM(CASE
        WHEN checked1by = 0 AND is_checked1 = 0
             AND current_step IN (7, 8)
        THEN 1 ELSE 0 END) AS PendingCheck1,
    SUM(CASE
        WHEN checked2by = 0 AND is_checked2 = 0
             AND current_step IN (8, 9)
        THEN 1 ELSE 0 END) AS PendingCheck2,
    SUM(CASE
        WHEN checked_scan1by > 0 AND is_checked_scan1 = 0
             AND current_step IN (1, 2)
        THEN 1 ELSE 0 END) AS InProgressCheckScan1,
    SUM(CASE
        WHEN checked_scan2by > 0 AND is_checked_scan2 = 0
             AND (is_checked_scan1 = 1 OR current_step >= 3)
        THEN 1 ELSE 0 END) AS InProgressCheckScan2,
    SUM(CASE
        WHEN extracted_by > 0 AND is_extracted = 0
             AND current_step IN (6, 7, 8)
        THEN 1 ELSE 0 END) AS InProgressExtract,
    SUM(CASE
        WHEN checked1by > 0 AND is_checked1 = 0
             AND current_step IN (7, 8)
        THEN 1 ELSE 0 END) AS InProgressCheck1,
    SUM(CASE
        WHEN checked2by > 0 AND is_checked2 = 0
             AND current_step IN (8, 9)
        THEN 1 ELSE 0 END) AS InProgressCheck2,
    SUM(CASE WHEN is_checked_scan1 = 1 THEN 1 ELSE 0 END) AS CompletedCheckScan1,
    SUM(CASE WHEN is_checked_scan2 = 1 THEN 1 ELSE 0 END) AS CompletedCheckScan2,
    SUM(CASE WHEN is_extracted = 1 THEN 1 ELSE 0 END) AS CompletedExtract,
    SUM(CASE WHEN is_checked1 = 1 THEN 1 ELSE 0 END) AS CompletedCheck1,
    SUM(CASE WHEN is_checked2 = 1 THEN 1 ELSE 0 END) AS CompletedCheck2
FROM (
    SELECT
        NULLIF(LTRIM(RTRIM({fieldColumn})), N'') AS child_name,
        checked_scan1by,
        is_checked_scan1,
        checked_scan2by,
        is_checked_scan2,
        extracted_by,
        is_extracted,
        checked1by,
        is_checked1,
        checked2by,
        is_checked2,
        current_step
    FROM dbo.stg_documents
    WHERE status = 1
      AND NULLIF(LTRIM(RTRIM({fieldColumn})), N'') IS NOT NULL
      AND ({parentFieldMatchSql})
      AND (
            @ParentPath = N''
            OR REPLACE(REPLACE(COALESCE(NULLIF(path_original, N''), NULLIF(file_path, N''), N''), N'\', N'/'), N'//', N'/') = @ParentPath
            OR REPLACE(REPLACE(COALESCE(NULLIF(path_original, N''), NULLIF(file_path, N''), N''), N'\', N'/'), N'//', N'/') LIKE @ParentPath + N'/%'
      )
) scoped
WHERE child_name IS NOT NULL
  AND (@Filter = N'' OR child_name LIKE N'%' + @Filter + N'%')
GROUP BY child_name
ORDER BY TotalDocuments DESC, child_name ASC;";

        var parameters = new DynamicParameters();
        parameters.Add("ParentPath", parentPath);
        parameters.Add("Filter", filter);
        AddParentFieldMatchParameters(parameters, parentPath, parentDepth);

        var rows = (await conn.QueryAsync<ConstructionFolderBatchRowViewModel>(sql, parameters)).ToList();

        foreach (var row in rows)
            row.HasChildren = true;

        return rows;
    }

    private IReadOnlyList<string> GetStorageChildNames(string parentLogicalPath)
    {
        var root = _storageOptions.RootPath?.Trim();
        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
            return Array.Empty<string>();

        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var logicalRel = parentLogicalPath.Replace('/', Path.DirectorySeparatorChar);
        var searchRoots = new List<string> { root };
        foreach (var top in Directory.EnumerateDirectories(root))
            searchRoots.Add(top);

        foreach (var baseDir in searchRoots.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var physicalParent = string.IsNullOrEmpty(logicalRel)
                ? baseDir
                : Path.Combine(baseDir, logicalRel);
            if (!Directory.Exists(physicalParent))
                continue;

            foreach (var dir in Directory.EnumerateDirectories(physicalParent))
            {
                var name = Path.GetFileName(dir);
                if (!string.IsNullOrWhiteSpace(name))
                    found.Add(name);
            }
        }

        return found.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static List<ConstructionFolderBatchRowViewModel> MergeFolderRows(
        List<ConstructionFolderBatchRowViewModel> pathRows,
        List<ConstructionFolderBatchRowViewModel> metadataRows,
        IReadOnlyList<string> storageChildren,
        string parentPath,
        int parentDepth,
        int folderSegmentCount,
        bool listFilesAtCurrentLevel)
    {
        var map = new Dictionary<string, ConstructionFolderBatchRowViewModel>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in pathRows.Concat(metadataRows))
        {
            if (string.IsNullOrWhiteSpace(row.FolderName) || row.TotalDocuments <= 0)
                continue;

            if (map.TryGetValue(row.FolderName, out var existing))
            {
                existing.TotalDocuments = Math.Max(existing.TotalDocuments, row.TotalDocuments);
                existing.PendingCheckScan1 = Math.Max(existing.PendingCheckScan1, row.PendingCheckScan1);
                existing.PendingCheckScan2 = Math.Max(existing.PendingCheckScan2, row.PendingCheckScan2);
                existing.PendingExtract = Math.Max(existing.PendingExtract, row.PendingExtract);
                existing.PendingCheck1 = Math.Max(existing.PendingCheck1, row.PendingCheck1);
                existing.PendingCheck2 = Math.Max(existing.PendingCheck2, row.PendingCheck2);
                existing.InProgressCheckScan1 = Math.Max(existing.InProgressCheckScan1, row.InProgressCheckScan1);
                existing.InProgressCheckScan2 = Math.Max(existing.InProgressCheckScan2, row.InProgressCheckScan2);
                existing.InProgressExtract = Math.Max(existing.InProgressExtract, row.InProgressExtract);
                existing.InProgressCheck1 = Math.Max(existing.InProgressCheck1, row.InProgressCheck1);
                existing.InProgressCheck2 = Math.Max(existing.InProgressCheck2, row.InProgressCheck2);
                existing.CompletedCheckScan1 = Math.Max(existing.CompletedCheckScan1, row.CompletedCheckScan1);
                existing.CompletedCheckScan2 = Math.Max(existing.CompletedCheckScan2, row.CompletedCheckScan2);
                existing.CompletedExtract = Math.Max(existing.CompletedExtract, row.CompletedExtract);
                existing.CompletedCheck1 = Math.Max(existing.CompletedCheck1, row.CompletedCheck1);
                existing.CompletedCheck2 = Math.Max(existing.CompletedCheck2, row.CompletedCheck2);
                existing.HasChildren = existing.HasChildren || row.HasChildren;
            }
            else
            {
                map[row.FolderName] = row;
            }
        }

        if (storageChildren.Count > 0)
        {
            var storageSet = new HashSet<string>(storageChildren, StringComparer.OrdinalIgnoreCase);
            foreach (var row in map.Values)
            {
                if (storageSet.Contains(row.FolderName))
                    row.HasChildren = row.HasChildren || (!listFilesAtCurrentLevel && parentDepth + 1 < folderSegmentCount);
            }
        }

        return map.Values
            .Where(x => x.TotalDocuments > 0)
            .OrderByDescending(x => x.TotalDocuments)
            .ThenBy(x => x.FolderName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

  private static string ResolveFolderFieldColumn(int parentDepth)
    {
        var index = Math.Clamp(parentDepth, 1, 15);
        return $"field{index}";
    }

    private static string BuildParentFieldMatchSql(string parentPath, int parentDepth)
    {
        if (parentDepth <= 1)
            return "1 = 1";

        var segments = parentPath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var conditions = new List<string>();
        for (var i = 1; i < parentDepth && i < segments.Length; i++)
            conditions.Add($"NULLIF(LTRIM(RTRIM(field{i})), N'') = @ParentField{i}");

        return conditions.Count == 0 ? "1 = 1" : string.Join(" AND ", conditions);
    }

    private static void AddParentFieldMatchParameters(DynamicParameters parameters, string parentPath, int parentDepth)
    {
        if (parentDepth <= 1)
            return;

        var segments = parentPath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        for (var i = 1; i < parentDepth && i < segments.Length; i++)
            parameters.Add($"ParentField{i}", segments[i]);
    }

    private static List<ConstructionFolderBatchRowViewModel> ApplyFolderNavigationRules(
        List<ConstructionFolderBatchRowViewModel> rows,
        int parentDepth,
        int folderSegmentCount,
        bool listFilesAtCurrentLevel)
    {
        if (!listFilesAtCurrentLevel)
        {
            rows = rows
                .Where(r => !SyncPathFormatParser.LooksLikePdfFileName(r.FolderName))
                .ToList();

            foreach (var row in rows)
            {
                row.IsPdfFile = false;
                if (parentDepth + 1 < folderSegmentCount)
                    row.HasChildren = true;
            }

            return rows;
        }

        foreach (var row in rows)
        {
            row.IsPdfFile = SyncPathFormatParser.LooksLikePdfFileName(row.FolderName);
            row.HasChildren = false;
        }

        return rows;
    }

    private static string NormalizeFolderPath(string? folderPath)
    {
        if (string.IsNullOrWhiteSpace(folderPath))
            return string.Empty;

        return folderPath
            .Trim()
            .Replace('\\', '/')
            .Trim('/');
    }

    private static string? GetParentFolderPath(string currentPath)
    {
        if (string.IsNullOrEmpty(currentPath))
            return null;

        var idx = currentPath.LastIndexOf('/');
        return idx < 0 ? string.Empty : currentPath[..idx];
    }

    private static IReadOnlyList<string> BuildBreadcrumb(string currentPath)
    {
        if (string.IsNullOrEmpty(currentPath))
            return Array.Empty<string>();

        return currentPath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private static string GetStepLabel(WorkflowStep step) => step switch
    {
        WorkflowStep.CheckScan1 => "Kiểm tra scan 1",
        WorkflowStep.CheckScan2 => "Kiểm tra scan 2",
        WorkflowStep.Extract => "Nhập liệu",
        WorkflowStep.Check1 => "Kiểm tra lần 1",
        WorkflowStep.Check2 => "Kiểm tra lần 2",
        _ => step.ToString()
    };
}
