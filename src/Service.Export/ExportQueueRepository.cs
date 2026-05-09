using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using SHTL.Exporting;

namespace SHTL.Service.Export;

internal sealed class ExportJobRow
{
    public long Id { get; set; }
    public int ExportTypeId { get; set; }
    public string? ExportInputJson { get; set; }
    public int FieldFolderExport { get; set; }
    public bool IsExportFile { get; set; }
}

internal sealed class ExportTypeRow
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? JsonConfig { get; set; }
}

internal sealed class ExportQueueRepository
{
    private readonly string _connectionString;

    public ExportQueueRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
    }

    public async Task<IReadOnlyList<ExportJobRow>> GetPendingAsync(int limit, CancellationToken ct = default)
    {
        const string sql = """
            SELECT id, export_type_id AS ExportTypeId, export_input_json AS ExportInputJson,
                   field_folder_export AS FieldFolderExport, is_export_file AS IsExportFile
            FROM dbo.stg_export_jobs
            WHERE status = 0
            ORDER BY id ASC
            OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct).ConfigureAwait(false);
        var list = await conn.QueryAsync<ExportJobRow>(
            new CommandDefinition(sql, new { Limit = limit }, cancellationToken: ct)).ConfigureAwait(false);
        return list.AsList();
    }

    public async Task<ExportTypeRow?> GetExportTypeAsync(int id, CancellationToken ct = default)
    {
        const string sql = """
            SELECT id, code, json_config AS JsonConfig
            FROM dbo.cnf_export_types
            WHERE id = @Id
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct).ConfigureAwait(false);
        return await conn.QueryFirstOrDefaultAsync<ExportTypeRow>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task UpdateProgressAsync(
        long jobId,
        int processed,
        int success,
        int error,
        byte status,
        string? downloadPath,
        string? message,
        CancellationToken ct = default)
    {
        const string sql = """
            UPDATE dbo.stg_export_jobs SET
                processed = @Processed, success = @Success, error = @Error,
                status = @Status, download_path = @DownloadPath,
                message = @Message,
                completed_at = CASE WHEN @Status IN (2, 3) THEN SYSUTCDATETIME() ELSE completed_at END
            WHERE id = @Id
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct).ConfigureAwait(false);
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = jobId,
            Processed = processed,
            Success = success,
            Error = error,
            Status = status,
            DownloadPath = downloadPath,
            Message = message
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public static ExportJobContext ToContext(ExportJobRow r) => new()
    {
        Id = r.Id,
        ExportTypeId = r.ExportTypeId,
        ExportInputJson = r.ExportInputJson,
        FieldFolderExport = r.FieldFolderExport,
        IsExportFile = r.IsExportFile
    };

    public static ExportTypeContext ToContext(ExportTypeRow r) => new()
    {
        Id = r.Id,
        Code = r.Code,
        JsonConfig = r.JsonConfig
    };
}
