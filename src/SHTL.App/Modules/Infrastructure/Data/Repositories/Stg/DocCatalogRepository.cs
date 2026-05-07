using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IDocCatalogRepository
{
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(string? search);
    Task<DocTypeListItemDto?> GetDocTypeAsync(int id);
    Task<int> InsertDocTypeAsync(DocTypeEditRequest req, int userId);
    Task<int> UpdateDocTypeAsync(DocTypeEditRequest req, int userId);
    Task<int> DeleteDocTypeAsync(int id);
    Task<int> DeleteSyncTypesByDocTypeAsync(int docTypeId);
    Task<long> CountDocumentsByDocTypeAsync(int docTypeId);

    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(string? search);
    Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int id);
    Task<int> InsertDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int userId);
    Task<int> UpdateDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int userId);
    Task<int> DeleteDocTypeSyncTypeAsync(int id);
    Task<long> CountDocumentsBySyncTypeAsync(int syncTypeId);
}

public class DocCatalogRepository : BaseRepository, IDocCatalogRepository
{
    public DocCatalogRepository(AppDbContext db) : base(db) { }

    public async Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(string? search)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            SELECT id AS Id, name AS Name, code AS Code, [describe] AS Describe,
                   separate_type_id AS SeparateTypeId, extractor_type_id AS ExtractorTypeId,
                   review_status AS ReviewStatus, weight AS Weight
            FROM dbo.stg_doc_types
            WHERE 1 = 1";
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (name LIKE @Like OR code LIKE @Like OR [describe] LIKE @Like)";
        }
        sql += " ORDER BY weight, name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        var rows = await QueryAsync<DocTypeListItemDto>(conn, sql, new { Like = like });
        return rows.ToList();
    }

    public async Task<DocTypeListItemDto?> GetDocTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<DocTypeListItemDto>(conn, @"
            SELECT id AS Id, name AS Name, code AS Code, [describe] AS Describe,
                   separate_type_id AS SeparateTypeId, extractor_type_id AS ExtractorTypeId,
                   review_status AS ReviewStatus, weight AS Weight
            FROM dbo.stg_doc_types
            WHERE id = @Id",
            new { Id = id });
    }

    public async Task<int> InsertDocTypeAsync(DocTypeEditRequest req, int userId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_types
                (name, code, [describe], separate_type_id, extractor_type_id, review_status, weight, created, created_by)
            VALUES
                (@Name, @Code, @Describe, @SeparateTypeId, @ExtractorTypeId, @ReviewStatus, @Weight, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
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

    public async Task<int> UpdateDocTypeAsync(DocTypeEditRequest req, int userId)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.stg_doc_types SET
                name = @Name, code = @Code, [describe] = @Describe,
                separate_type_id = @SeparateTypeId, extractor_type_id = @ExtractorTypeId,
                review_status = @ReviewStatus, weight = @Weight,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id",
            new
            {
                req.Id,
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

    public async Task<int> DeleteDocTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "DELETE FROM dbo.stg_doc_types WHERE id = @Id",
            new { Id = id });
    }

    public async Task<int> DeleteSyncTypesByDocTypeAsync(int docTypeId)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "DELETE FROM dbo.stg_doc_type_sync_types WHERE doc_type_id = @DocTypeId",
            new { DocTypeId = docTypeId });
    }

    public async Task<long> CountDocumentsByDocTypeAsync(int docTypeId)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteScalarAsync<long>(conn,
            "SELECT COUNT(1) FROM dbo.stg_documents WHERE doc_type_id = @DocTypeId",
            new { DocTypeId = docTypeId });
    }

    public async Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(string? search)
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
        var rows = await QueryAsync<DocTypeSyncListItemDto>(conn, sql, new { Like = like });
        return rows.ToList();
    }

    public async Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<DocTypeSyncListItemDto>(conn, @"
            SELECT s.id AS Id, s.doc_type_id AS DocTypeId,
                   ISNULL(t.name, N'') AS DocTypeName, s.name AS Name, s.[describe] AS Describe,
                   s.format AS Format, s.weight AS Weight, s.is_default AS IsDefault
            FROM dbo.stg_doc_type_sync_types s
            LEFT JOIN dbo.stg_doc_types t ON t.id = s.doc_type_id
            WHERE s.id = @Id",
            new { Id = id });
    }

    public async Task<int> InsertDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int userId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_type_sync_types
                (doc_type_id, name, [describe], format, scan_path_root, weight, is_default, created, created_by)
            VALUES
                (@DocTypeId, @Name, @Describe, @Format, @ScanPathRoot, @Weight, @IsDefault, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            req.DocTypeId,
            req.Name,
            req.Describe,
            req.Format,
            req.ScanPathRoot,
            req.Weight,
            req.IsDefault,
            UserId = userId
        });
    }

    public async Task<int> UpdateDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int userId)
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
                req.Id,
                req.DocTypeId,
                req.Name,
                req.Describe,
                req.Format,
                req.ScanPathRoot,
                req.Weight,
                req.IsDefault,
                UserId = userId
            });
    }

    public async Task<int> DeleteDocTypeSyncTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "DELETE FROM dbo.stg_doc_type_sync_types WHERE id = @Id",
            new { Id = id });
    }

    public async Task<long> CountDocumentsBySyncTypeAsync(int syncTypeId)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteScalarAsync<long>(conn,
            "SELECT COUNT(1) FROM dbo.stg_documents WHERE sync_type_id = @SyncTypeId",
            new { SyncTypeId = syncTypeId });
    }
}
