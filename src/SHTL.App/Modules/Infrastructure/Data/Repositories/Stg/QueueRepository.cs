using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;

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
}

public class ExportJobRepository : BaseRepository, IExportJobRepository
{
    public ExportJobRepository(AppDbContext db) : base(db) { }

    public async Task<long> EnqueueAsync(ExportJob job)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            INSERT INTO dbo.stg_export_jobs
                (export_type_id, filter_json, status, created_at, requested_by)
            OUTPUT INSERTED.id
            VALUES (@ExportTypeId, @FilterJson, @Status, @CreatedAt, @RequestedBy)";
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
            new { Id = id, Processed = processed, Success = success, Error = error,
                  Status = (byte)status, DownloadPath = downloadPath, Message = message });
    }

    public async Task<ExportJob?> GetByIdAsync(long id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<ExportJob>(conn,
            "SELECT * FROM dbo.stg_export_jobs WHERE id = @Id", new { Id = id });
    }
}
