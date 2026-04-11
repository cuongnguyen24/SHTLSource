using Core.Domain.Entities.Stg;
using Core.Domain.Contracts;
using Dapper;

namespace Infrastructure.Data.Repositories.Stg;

public class ExportTypeRepository : BaseRepository, IExportTypeRepository
{
    public ExportTypeRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<ExportType?> GetByIdAsync(long id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<ExportType>(conn,
            "SELECT * FROM export_types WHERE id = @Id", new { Id = id });
    }

    public async Task<IEnumerable<ExportType>> GetAllAsync()
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryAsync<ExportType>(conn, "SELECT * FROM export_types ORDER BY created DESC");
    }

    public async Task<long> InsertAsync(ExportType entity)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            INSERT INTO export_types
                (channel_id, name, code, description, excel_file_path, excel_file_name, 
                 json_config, search_meta, is_active, created, created_by)
            VALUES
                (@ChannelId, @Name, @Code, @Description, @ExcelFilePath, @ExcelFileName,
                 @JsonConfig, @SearchMeta, @IsActive, @Created, @CreatedBy);
            SELECT LAST_INSERT_ID();";
        
        return await conn.ExecuteScalarAsync<long>(sql, entity);
    }

    public async Task<int> UpdateAsync(ExportType entity)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            UPDATE export_types SET
                name = @Name,
                code = @Code,
                description = @Description,
                excel_file_path = @ExcelFilePath,
                excel_file_name = @ExcelFileName,
                json_config = @JsonConfig,
                search_meta = @SearchMeta,
                is_active = @IsActive,
                updated = @Updated,
                updated_by = @UpdatedBy
            WHERE id = @Id";
        
        return await ExecuteAsync(conn, sql, entity);
    }

    public async Task<int> DeleteAsync(long id)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn, "DELETE FROM export_types WHERE id = @Id", new { Id = id });
    }

    public async Task<IEnumerable<ExportType>> GetByChannelAsync(int channelId, bool activeOnly = true)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = $@"
            SELECT * FROM export_types
            WHERE channel_id = @ChannelId
            {(activeOnly ? "AND is_active = 1" : "")}
            ORDER BY created DESC";
        
        return await QueryAsync<ExportType>(conn, sql, new { ChannelId = channelId });
    }

    public async Task<ExportType?> GetByCodeAsync(int channelId, string code)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            SELECT * FROM export_types
            WHERE channel_id = @ChannelId AND code = @Code
            LIMIT 1";
        
        return await QueryFirstOrDefaultAsync<ExportType>(conn, sql, new { ChannelId = channelId, Code = code });
    }

    public async Task<bool> IsCodeExistsAsync(int channelId, string code, int? excludeId = null)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = $@"
            SELECT COUNT(1) FROM export_types
            WHERE channel_id = @ChannelId AND code = @Code
            {(excludeId.HasValue ? "AND id != @ExcludeId" : "")}";
        
        var count = await ExecuteScalarAsync<int>(conn, sql, new { ChannelId = channelId, Code = code, ExcludeId = excludeId });
        return count > 0;
    }

    public async Task<IEnumerable<ExportType>> SearchAsync(int channelId, string searchTerm)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            SELECT * FROM export_types
            WHERE channel_id = @ChannelId
            AND (
                name LIKE @Term
                OR code LIKE @Term
                OR description LIKE @Term
                OR search_meta LIKE @Term
            )
            ORDER BY created DESC";
        
        var term = $"%{searchTerm}%";
        return await QueryAsync<ExportType>(conn, sql, new { ChannelId = channelId, Term = term });
    }
}
