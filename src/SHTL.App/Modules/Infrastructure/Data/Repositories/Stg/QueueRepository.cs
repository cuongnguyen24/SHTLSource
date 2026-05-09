using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IOcrJobRepository
{
    Task<long> EnqueueAsync(OcrJob job);
    Task<IEnumerable<OcrJob>> GetPendingAsync(int limit = 10);
    Task<int> UpdateStatusAsync(long id, QueueStatus status, string? message = null);
}

public class OcrJobRepository : BaseRepository, IOcrJobRepository
{
    public OcrJobRepository(AppDbContext db) : base(db) { }

    public async Task<long> EnqueueAsync(OcrJob job)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            INSERT INTO dbo.stg_ocr_jobs (document_id, type, status, created_at, retry_count, priority)
            OUTPUT INSERTED.id
            VALUES (@DocumentId, @Type, @Status, @CreatedAt, @RetryCount, @Priority)";
        return await ExecuteScalarAsync<long>(conn, sql, job);
    }

    public async Task<IEnumerable<OcrJob>> GetPendingAsync(int limit = 10)
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<OcrJob>(conn,
            @"SELECT * FROM dbo.stg_ocr_jobs WHERE status = 0 ORDER BY priority DESC, id ASC
              OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY",
            new { Limit = limit });
    }

    public async Task<int> UpdateStatusAsync(long id, QueueStatus status, string? message = null)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "UPDATE dbo.stg_ocr_jobs SET status = @Status, message = @Message, processed_at = SYSUTCDATETIME() WHERE id = @Id",
            new { Id = id, Status = (byte)status, Message = message });
    }
}

public interface IExportJobRepository
{
    Task<long> EnqueueAsync(ExportJob job);
    Task<IEnumerable<ExportJob>> GetPendingAsync(int limit = 5);
    Task<int> UpdateProgressAsync(long id, int processed, int success, int error, QueueStatus status, string? downloadPath = null, string? message = null);
    Task<ExportJob?> GetByIdAsync(long id);

    /// <summary>Danh sách job kèm JOIN loại xuất, user, phòng ban (màn SoHoa/Export).</summary>
    Task<IReadOnlyList<ExportJobListRow>> SearchAsync(
        string? q,
        DateTime? createdFromUtc,
        DateTime? createdToExclusiveUtc,
        int? exportTypeId);

    Task<int> UpdateEditableAsync(ExportJob job);
    Task<int> DeleteAsync(long id);
    /// <summary>Đưa job về hàng đợi (chạy lại).</summary>
    Task<int> ResetToPendingAsync(long id);
}

public class ExportJobRepository : BaseRepository, IExportJobRepository
{
    public ExportJobRepository(AppDbContext db) : base(db) { }

    public async Task<long> EnqueueAsync(ExportJob job)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            INSERT INTO dbo.stg_export_jobs
                (export_type_id, name, filter_json, export_input_json, field_folder_export, doc_status, is_export_file,
                 status, created_at, total, processed, success, error, compressed_percent, requested_by, dept_id)
            OUTPUT INSERTED.id
            VALUES
                (@ExportTypeId, @Name, @FilterJson, @ExportInputJson, @FieldFolderExport, @DocStatus, @IsExportFile,
                 @Status, @CreatedAt, @Total, @Processed, @Success, @Error, @CompressedPercent, @RequestedBy, @DeptId)";
        return await ExecuteScalarAsync<long>(conn, sql, job);
    }

    public async Task<IEnumerable<ExportJob>> GetPendingAsync(int limit = 5)
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<ExportJob>(conn,
            @"SELECT * FROM dbo.stg_export_jobs WHERE status = 0 ORDER BY id ASC
              OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY",
            new { Limit = limit });
    }

    public async Task<int> UpdateProgressAsync(long id, int processed, int success, int error, QueueStatus status, string? downloadPath = null, string? message = null)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.stg_export_jobs SET
                processed = @Processed, success = @Success, error = @Error,
                status = @Status, download_path = @DownloadPath,
                message = @Message, completed_at = CASE WHEN @Status IN (2,3) THEN SYSUTCDATETIME() ELSE NULL END
            WHERE id = @Id",
            new
            {
                Id = id,
                Processed = processed,
                Success = success,
                Error = error,
                Status = (byte)status,
                DownloadPath = downloadPath,
                Message = message
            });
    }

    public async Task<ExportJob?> GetByIdAsync(long id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<ExportJob>(conn,
            "SELECT * FROM dbo.stg_export_jobs WHERE id = @Id", new { Id = id });
    }

    public async Task<IReadOnlyList<ExportJobListRow>> SearchAsync(
        string? q,
        DateTime? createdFromUtc,
        DateTime? createdToExclusiveUtc,
        int? exportTypeId)
    {
        var conn = await OpenConnectionAsync();
        string? qLike = null;
        if (!string.IsNullOrWhiteSpace(q))
            qLike = "%" + q.Trim() + "%";

        const string sql = """
            SELECT
                j.id AS Id,
                j.export_type_id AS ExportTypeId,
                j.name AS Name,
                j.filter_json AS FilterJson,
                j.export_input_json AS ExportInputJson,
                j.field_folder_export AS FieldFolderExport,
                j.doc_status AS DocStatus,
                j.is_export_file AS IsExportFile,
                j.status AS Status,
                j.created_at AS CreatedAt,
                j.processed_at AS ProcessedAt,
                j.completed_at AS CompletedAt,
                j.total AS Total,
                j.processed AS Processed,
                j.success AS Success,
                j.error AS Error,
                j.download_path AS DownloadPath,
                j.message AS Message,
                j.requested_by AS RequestedBy,
                j.dept_id AS DeptId,
                et.name AS ExportTypeName,
                ISNULL(NULLIF(LTRIM(RTRIM(u.full_name)), N''), u.user_name) AS RequestedByUserName,
                dp.name AS DeptName
            FROM dbo.stg_export_jobs j
            LEFT JOIN dbo.cnf_export_types et ON et.id = j.export_type_id
            LEFT JOIN dbo.acc_users u ON u.id = j.requested_by
            LEFT JOIN dbo.acc_depts dp ON dp.id = j.dept_id
            WHERE (@QLike IS NULL OR j.name LIKE @QLike OR et.name LIKE @QLike
                   OR u.full_name LIKE @QLike OR u.user_name LIKE @QLike)
              AND (@FromUtc IS NULL OR j.created_at >= @FromUtc)
              AND (@ToExUtc IS NULL OR j.created_at < @ToExUtc)
              AND (@ExportTypeId IS NULL OR j.export_type_id = @ExportTypeId)
            ORDER BY j.id DESC
            """;
        var rows = await QueryAsync<ExportJobListRow>(conn, sql, new
        {
            QLike = qLike,
            FromUtc = createdFromUtc,
            ToExUtc = createdToExclusiveUtc,
            ExportTypeId = exportTypeId
        });
        return rows.ToList();
    }

    public async Task<int> UpdateEditableAsync(ExportJob job)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, """
            UPDATE dbo.stg_export_jobs SET
                export_type_id = @ExportTypeId,
                name = @Name,
                filter_json = @FilterJson,
                export_input_json = @ExportInputJson,
                field_folder_export = @FieldFolderExport,
                doc_status = @DocStatus,
                is_export_file = @IsExportFile
            WHERE id = @Id AND status <> 1
            """, job);
    }

    public async Task<int> DeleteAsync(long id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, "DELETE FROM dbo.stg_export_jobs WHERE id = @Id AND status <> 1", new { Id = id });
    }

    public async Task<int> ResetToPendingAsync(long id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, """
            UPDATE dbo.stg_export_jobs SET
                status = 0,
                processed = 0, success = 0, error = 0, total = 0,
                message = NULL, download_path = NULL, download_log_path = NULL,
                processed_at = NULL, completed_at = NULL
            WHERE id = @Id AND status <> 1
            """, new { Id = id });
    }
}
