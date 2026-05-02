using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IAxeSyncTypeRepository
{
    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListAsync(string? search);
    Task<DocTypeSyncFullDto?> GetAsync(int id);
    Task<bool> NameExistsAsync(string name, int excludeId);
    Task<int> InsertAsync(DocTypeSyncFullDto row, int userId);
    Task<int> UpdateAsync(DocTypeSyncFullDto row, int userId);
    Task DeleteAsync(int id);

    Task<IReadOnlyList<DocTypeSyncSettingDto>> GetSettingsAsync(int syncTypeId);
    Task DeleteSettingsAsync(int syncTypeId);
    Task InsertSettingsAsync(IReadOnlyList<DocTypeSyncSettingDto> rows);
}

public class AxeSyncTypeRepository : BaseRepository, IAxeSyncTypeRepository
{
    public AxeSyncTypeRepository(AppDbContext db) : base(db) { }

    public async Task<IReadOnlyList<DocTypeSyncListItemDto>> ListAsync(string? search)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            SELECT s.id AS Id, s.doc_type_id AS DocTypeId,
                   ISNULL(t.name, N'') AS DocTypeName, s.name AS Name, s.[describe] AS Describe,
                   s.format AS Format, s.weight AS Weight, s.is_default AS IsDefault
            FROM dbo.stg_doc_type_sync_types s
            LEFT JOIN dbo.stg_doc_types t ON t.id = s.doc_type_id
            WHERE 1 = 1";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (s.name LIKE @Like OR s.[describe] LIKE @Like OR s.format LIKE @Like OR t.name LIKE @Like)";
        sql += " ORDER BY s.weight, s.name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        return (await QueryAsync<DocTypeSyncListItemDto>(conn, sql, new { Like = like })).ToList();
    }

    public async Task<DocTypeSyncFullDto?> GetAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<DocTypeSyncFullDto>(conn, @"
            SELECT id AS Id, doc_type_id AS DocTypeId, name AS Name,
                   [describe] AS Describe, format AS Format, scan_path_root AS ScanPathRoot,
                   weight AS Weight, is_default AS IsDefault
            FROM dbo.stg_doc_type_sync_types
            WHERE id = @Id",
            new { Id = id });
    }

    public async Task<bool> NameExistsAsync(string name, int excludeId)
    {
        var conn = await OpenConnectionAsync();
        var n = await ExecuteScalarAsync<int>(conn,
            @"SELECT COUNT(1) FROM dbo.stg_doc_type_sync_types
              WHERE name = @Name AND id <> @Ex",
            new { Name = name, Ex = excludeId });
        return n > 0;
    }

    public async Task<int> InsertAsync(DocTypeSyncFullDto row, int userId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_type_sync_types
            (doc_type_id, name, [describe], format, scan_path_root, weight, is_default, created, created_by)
            VALUES (@DocTypeId, @Name, @Describe, @Format, @ScanPathRoot, @Weight, @IsDefault, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            row.DocTypeId,
            row.Name,
            row.Describe,
            row.Format,
            row.ScanPathRoot,
            row.Weight,
            row.IsDefault,
            UserId = userId
        });
    }

    public async Task<int> UpdateAsync(DocTypeSyncFullDto row, int userId)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.stg_doc_type_sync_types SET
                doc_type_id = @DocTypeId, name = @Name, [describe] = @Describe,
                format = @Format, scan_path_root = @ScanPathRoot, weight = @Weight, is_default = @IsDefault,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id",
            new
            {
                row.Id,
                row.DocTypeId,
                row.Name,
                row.Describe,
                row.Format,
                row.ScanPathRoot,
                row.Weight,
                row.IsDefault,
                UserId = userId
            });
    }

    public async Task DeleteAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_sync_settings WHERE id_type = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_sync_types WHERE id = @Id", new { Id = id });
    }

    public async Task<IReadOnlyList<DocTypeSyncSettingDto>> GetSettingsAsync(int syncTypeId)
    {
        var conn = await OpenConnectionAsync();
        return (await QueryAsync<DocTypeSyncSettingDto>(conn, @"
            SELECT id AS Id, id_type AS IdType, id_field AS IdField, id_pattern_type AS IdPatternType,
                   title AS Title, weight AS Weight, is_catalog AS IsCatalog, pattern_custom AS PatternCustom,
                   fix_value AS FixValue, min_value AS MinValue, max_value AS MaxValue,
                   min_len AS MinLen, max_len AS MaxLen, is_required AS IsRequired
            FROM dbo.stg_doc_type_sync_settings WHERE id_type = @Id ORDER BY weight",
            new { Id = syncTypeId })).ToList();
    }

    public async Task DeleteSettingsAsync(int syncTypeId)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_sync_settings WHERE id_type = @Id", new { Id = syncTypeId });
    }

    public async Task InsertSettingsAsync(IReadOnlyList<DocTypeSyncSettingDto> rows)
    {
        if (rows.Count == 0) return;
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_type_sync_settings
            (id_type, id_field, id_pattern_type, title, weight, is_catalog, pattern_custom, fix_value, min_value, max_value, min_len, max_len, is_required)
            VALUES (@IdType, @IdField, @IdPatternType, @Title, @Weight, @IsCatalog, @PatternCustom, @FixValue, @MinValue, @MaxValue, @MinLen, @MaxLen, @IsRequired)";
        foreach (var r in rows)
            await ExecuteAsync(conn, sql, r);
    }
}
