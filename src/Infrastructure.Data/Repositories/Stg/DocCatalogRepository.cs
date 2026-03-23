using Shared.Contracts.Dtos;

namespace Infrastructure.Data.Repositories.Stg;

public interface IDocCatalogRepository
{
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(int channelId, string? search);
    Task<DocTypeListItemDto?> GetDocTypeAsync(int channelId, int id);
    Task<int> InsertDocTypeAsync(DocTypeEditRequest req, int channelId, int userId);
    Task<int> UpdateDocTypeAsync(DocTypeEditRequest req, int channelId, int userId);
    Task<int> DeleteDocTypeAsync(int channelId, int id);
    Task<int> DeleteSyncTypesByDocTypeAsync(int channelId, int docTypeId);
    Task<long> CountDocumentsByDocTypeAsync(int channelId, int docTypeId);

    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(int channelId, string? search);
    Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int channelId, int id);
    Task<int> InsertDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, int userId);
    Task<int> UpdateDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, int userId);
    Task<int> DeleteDocTypeSyncTypeAsync(int channelId, int id);
    Task<long> CountDocumentsBySyncTypeAsync(int channelId, int syncTypeId);
}

public class DocCatalogRepository : BaseRepository, IDocCatalogRepository
{
    public DocCatalogRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(int channelId, string? search)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            SELECT id AS Id, channel_id AS ChannelId, name AS Name, code AS Code, [describe] AS Describe,
                   separate_type_id AS SeparateTypeId, extractor_type_id AS ExtractorTypeId,
                   review_status AS ReviewStatus, weight AS Weight
            FROM core_stg.doc_types
            WHERE channel_id = @ChannelId";
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (name LIKE @Like OR code LIKE @Like OR [describe] LIKE @Like)";
        }
        sql += " ORDER BY weight, name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        var rows = await QueryAsync<DocTypeListItemDto>(conn, sql, new { ChannelId = channelId, Like = like });
        return rows.ToList();
    }

    public async Task<DocTypeListItemDto?> GetDocTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<DocTypeListItemDto>(conn, @"
            SELECT id AS Id, channel_id AS ChannelId, name AS Name, code AS Code, [describe] AS Describe,
                   separate_type_id AS SeparateTypeId, extractor_type_id AS ExtractorTypeId,
                   review_status AS ReviewStatus, weight AS Weight
            FROM core_stg.doc_types
            WHERE channel_id = @ChannelId AND id = @Id",
            new { ChannelId = channelId, Id = id });
    }

    public async Task<int> InsertDocTypeAsync(DocTypeEditRequest req, int channelId, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.doc_types
                (channel_id, name, code, [describe], separate_type_id, extractor_type_id, review_status, weight, created, created_by)
            VALUES
                (@ChannelId, @Name, @Code, @Describe, @SeparateTypeId, @ExtractorTypeId, @ReviewStatus, @Weight, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            ChannelId = channelId,
            req.Name,
            req.Code,
            req.Describe,
            req.SeparateTypeId,
            ExtractorTypeId = req.ExtractorTypeId,
            req.ReviewStatus,
            req.Weight,
            UserId = userId
        });
    }

    public async Task<int> UpdateDocTypeAsync(DocTypeEditRequest req, int channelId, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn, @"
            UPDATE core_stg.doc_types SET
                name = @Name, code = @Code, [describe] = @Describe,
                separate_type_id = @SeparateTypeId, extractor_type_id = @ExtractorTypeId,
                review_status = @ReviewStatus, weight = @Weight,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id AND channel_id = @ChannelId",
            new
            {
                req.Id,
                ChannelId = channelId,
                req.Name,
                req.Code,
                req.Describe,
                req.SeparateTypeId,
                ExtractorTypeId = req.ExtractorTypeId,
                req.ReviewStatus,
                req.Weight,
                UserId = userId
            });
    }

    public async Task<int> DeleteDocTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn,
            "DELETE FROM core_stg.doc_types WHERE id = @Id AND channel_id = @ChannelId",
            new { Id = id, ChannelId = channelId });
    }

    public async Task<int> DeleteSyncTypesByDocTypeAsync(int channelId, int docTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn,
            "DELETE FROM core_stg.doc_type_sync_types WHERE channel_id = @ChannelId AND doc_type_id = @DocTypeId",
            new { ChannelId = channelId, DocTypeId = docTypeId });
    }

    public async Task<long> CountDocumentsByDocTypeAsync(int channelId, int docTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteScalarAsync<long>(conn,
            "SELECT COUNT(1) FROM core_stg.documents WHERE channel_id = @ChannelId AND doc_type_id = @DocTypeId",
            new { ChannelId = channelId, DocTypeId = docTypeId });
    }

    public async Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(int channelId, string? search)
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
        var rows = await QueryAsync<DocTypeSyncListItemDto>(conn, sql, new { ChannelId = channelId, Like = like });
        return rows.ToList();
    }

    public async Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<DocTypeSyncListItemDto>(conn, @"
            SELECT s.id AS Id, s.channel_id AS ChannelId, s.doc_type_id AS DocTypeId,
                   ISNULL(t.name, N'') AS DocTypeName, s.name AS Name, s.[describe] AS Describe,
                   s.format AS Format, s.weight AS Weight, s.is_default AS IsDefault
            FROM core_stg.doc_type_sync_types s
            LEFT JOIN core_stg.doc_types t ON t.id = s.doc_type_id AND t.channel_id = s.channel_id
            WHERE s.channel_id = @ChannelId AND s.id = @Id",
            new { ChannelId = channelId, Id = id });
    }

    public async Task<int> InsertDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.doc_type_sync_types
                (channel_id, doc_type_id, name, [describe], format, weight, is_default, created, created_by)
            VALUES
                (@ChannelId, @DocTypeId, @Name, @Describe, @Format, @Weight, @IsDefault, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            ChannelId = channelId,
            req.DocTypeId,
            req.Name,
            req.Describe,
            req.Format,
            req.Weight,
            req.IsDefault,
            UserId = userId
        });
    }

    public async Task<int> UpdateDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, int userId)
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
                req.Id,
                ChannelId = channelId,
                req.DocTypeId,
                req.Name,
                req.Describe,
                req.Format,
                req.Weight,
                req.IsDefault,
                UserId = userId
            });
    }

    public async Task<int> DeleteDocTypeSyncTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn,
            "DELETE FROM core_stg.doc_type_sync_types WHERE id = @Id AND channel_id = @ChannelId",
            new { Id = id, ChannelId = channelId });
    }

    public async Task<long> CountDocumentsBySyncTypeAsync(int channelId, int syncTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteScalarAsync<long>(conn,
            "SELECT COUNT(1) FROM core_stg.documents WHERE channel_id = @ChannelId AND sync_type_id = @SyncTypeId",
            new { ChannelId = channelId, SyncTypeId = syncTypeId });
    }
}
