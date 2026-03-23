using Shared.Contracts.Dtos;

namespace Infrastructure.Data.Repositories.Stg;

public interface IAxeSyncTypeRepository
{
    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListAsync(int channelId, string? search);
    Task<DocTypeSyncFullDto?> GetAsync(int channelId, int id);
    Task<bool> NameExistsAsync(int channelId, string name, int excludeId);
    Task<int> InsertAsync(DocTypeSyncFullDto row, int userId);
    Task<int> UpdateAsync(DocTypeSyncFullDto row, int userId);
    Task DeleteAsync(int channelId, int id);

    Task<IReadOnlyList<DocTypeSyncSettingDto>> GetSettingsAsync(int syncTypeId);
    Task DeleteSettingsAsync(int syncTypeId);
    Task InsertSettingsAsync(IReadOnlyList<DocTypeSyncSettingDto> rows);
}

public class AxeSyncTypeRepository : BaseRepository, IAxeSyncTypeRepository
{
    public AxeSyncTypeRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<IReadOnlyList<DocTypeSyncListItemDto>> ListAsync(int channelId, string? search)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            SELECT s.id AS Id, s.channel_id AS ChannelId, s.doc_type_id AS DocTypeId,
                   ISNULL(t.name, N'') AS DocTypeName, s.name AS Name, s.[describe] AS Describe,
                   s.format AS Format, s.weight AS Weight, s.is_default AS IsDefault
            FROM core_stg.doc_type_sync_types s
            LEFT JOIN core_stg.doc_types t ON t.id = s.doc_type_id AND t.channel_id = s.channel_id
            WHERE s.channel_id = @ChannelId";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (s.name LIKE @Like OR s.[describe] LIKE @Like OR s.format LIKE @Like OR t.name LIKE @Like)";
        sql += " ORDER BY s.weight, s.name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        return (await QueryAsync<DocTypeSyncListItemDto>(conn, sql, new { ChannelId = channelId, Like = like })).ToList();
    }

    public async Task<DocTypeSyncFullDto?> GetAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<DocTypeSyncFullDto>(conn, @"
            SELECT id AS Id, channel_id AS ChannelId, doc_type_id AS DocTypeId, name AS Name,
                   [describe] AS Describe, format AS Format, weight AS Weight, is_default AS IsDefault
            FROM core_stg.doc_type_sync_types WHERE channel_id = @C AND id = @Id",
            new { C = channelId, Id = id });
    }

    public async Task<bool> NameExistsAsync(int channelId, string name, int excludeId)
    {
        using var conn = _factory.CreateStgConnection();
        var n = await ExecuteScalarAsync<int>(conn,
            @"SELECT COUNT(1) FROM core_stg.doc_type_sync_types
              WHERE channel_id = @C AND name = @Name AND id <> @Ex",
            new { C = channelId, Name = name, Ex = excludeId });
        return n > 0;
    }

    public async Task<int> InsertAsync(DocTypeSyncFullDto row, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.doc_type_sync_types
            (channel_id, doc_type_id, name, [describe], format, weight, is_default, created, created_by)
            VALUES (@ChannelId, @DocTypeId, @Name, @Describe, @Format, @Weight, @IsDefault, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            row.ChannelId,
            row.DocTypeId,
            row.Name,
            row.Describe,
            row.Format,
            row.Weight,
            row.IsDefault,
            UserId = userId
        });
    }

    public async Task<int> UpdateAsync(DocTypeSyncFullDto row, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn, @"
            UPDATE core_stg.doc_type_sync_types SET
                doc_type_id = @DocTypeId, name = @Name, [describe] = @Describe,
                format = @Format, weight = @Weight, is_default = @IsDefault,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id AND channel_id = @ChannelId",
            new
            {
                row.Id,
                row.ChannelId,
                row.DocTypeId,
                row.Name,
                row.Describe,
                row.Format,
                row.Weight,
                row.IsDefault,
                UserId = userId
            });
    }

    public async Task DeleteAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn, "DELETE FROM core_stg.doc_type_sync_settings WHERE id_type = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM core_stg.doc_type_sync_types WHERE channel_id = @C AND id = @Id", new { C = channelId, Id = id });
    }

    public async Task<IReadOnlyList<DocTypeSyncSettingDto>> GetSettingsAsync(int syncTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        return (await QueryAsync<DocTypeSyncSettingDto>(conn, @"
            SELECT id AS Id, id_type AS IdType, id_field AS IdField, id_pattern_type AS IdPatternType,
                   title AS Title, weight AS Weight, is_catalog AS IsCatalog, pattern_custom AS PatternCustom,
                   fix_value AS FixValue, min_value AS MinValue, max_value AS MaxValue,
                   min_len AS MinLen, max_len AS MaxLen, is_required AS IsRequired
            FROM core_stg.doc_type_sync_settings WHERE id_type = @Id ORDER BY weight",
            new { Id = syncTypeId })).ToList();
    }

    public async Task DeleteSettingsAsync(int syncTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn, "DELETE FROM core_stg.doc_type_sync_settings WHERE id_type = @Id", new { Id = syncTypeId });
    }

    public async Task InsertSettingsAsync(IReadOnlyList<DocTypeSyncSettingDto> rows)
    {
        if (rows.Count == 0) return;
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.doc_type_sync_settings
            (id_type, id_field, id_pattern_type, title, weight, is_catalog, pattern_custom, fix_value, min_value, max_value, min_len, max_len, is_required)
            VALUES (@IdType, @IdField, @IdPatternType, @Title, @Weight, @IsCatalog, @PatternCustom, @FixValue, @MinValue, @MaxValue, @MinLen, @MaxLen, @IsRequired)";
        foreach (var r in rows)
            await ExecuteAsync(conn, sql, r);
    }
}
