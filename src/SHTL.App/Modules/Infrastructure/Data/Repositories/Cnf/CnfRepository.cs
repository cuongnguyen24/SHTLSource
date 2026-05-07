using Dapper;
using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Cnf;

public interface ICnfRepository
{
    Task<IEnumerable<ConfigItemDto>> GetConfigsAsync();
    Task UpsertConfigAsync(string key, string? value, int updatedBy, string? groupName = null, string? description = null);

    Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync();
    Task InsertContentTypeAsync(ContentTypeRequest req, int createdBy);
    Task UpdateContentTypeAsync(ContentTypeRequest req, int updatedBy);

    Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync();
    Task InsertRecordTypeAsync(RecordTypeRequest req, int createdBy);
    Task UpdateRecordTypeAsync(RecordTypeRequest req, int updatedBy);

    Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync();
    Task InsertSyncTypeAsync(SyncTypeRequest req, int createdBy);
    Task UpdateSyncTypeAsync(SyncTypeRequest req, int updatedBy);

    Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync();
    Task InsertExportTypeAsync(ExportTypeRequest req, int createdBy);
    Task UpdateExportTypeAsync(ExportTypeRequest req, int updatedBy);

    Task<IEnumerable<ContentTypeDocRowDto>> GetDocTypeContentTypesAsync();

    Task<IEnumerable<SeparateTypeRowDto>> GetSeparateTypesAsync();
}

public class CnfRepository : BaseRepository, ICnfRepository
{
    public CnfRepository(AppDbContext db) : base(db) { }

    public async Task<IEnumerable<ConfigItemDto>> GetConfigsAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<ConfigItemDto>(conn,
            @"SELECT id AS Id, [key] AS [Key], value AS Value,
                     group_name AS GroupName, [description] AS Description
              FROM dbo.cnf_configs ORDER BY group_name, [key]");
    }

    public async Task UpsertConfigAsync(string key, string? value, int updatedBy, string? groupName = null, string? description = null)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn, @"
            MERGE dbo.cnf_configs WITH (HOLDLOCK) AS t
            USING (SELECT @Key AS cfg_key, @Value AS cfg_val, @GroupName AS gname, @Description AS descr) AS s
            ON (t.[key] = s.cfg_key)
            WHEN MATCHED THEN UPDATE SET
                value = s.cfg_val,
                group_name = COALESCE(s.gname, t.group_name),
                [description] = COALESCE(s.descr, t.[description])
            WHEN NOT MATCHED THEN INSERT ([key], value, group_name, [description])
                VALUES (s.cfg_key, s.cfg_val, s.gname, s.descr);",
            new { Key = key, Value = value, GroupName = groupName, Description = description });
    }

    public async Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<ContentTypeDto>(conn,
            "SELECT id, name, code, is_active FROM dbo.cnf_content_types ORDER BY weight, name");
    }

    public async Task InsertContentTypeAsync(ContentTypeRequest req, int createdBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "INSERT INTO dbo.cnf_content_types (name, code, is_active, created, created_by) VALUES (@Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateContentTypeAsync(ContentTypeRequest req, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "UPDATE dbo.cnf_content_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { req.Id, req.Name, req.Code, UpdatedBy = updatedBy });
    }

    public async Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<RecordTypeDto>(conn,
            "SELECT id, name, code, is_active FROM dbo.cnf_record_types ORDER BY weight, name");
    }

    public async Task InsertRecordTypeAsync(RecordTypeRequest req, int createdBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "INSERT INTO dbo.cnf_record_types (name, code, is_active, created, created_by) VALUES (@Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateRecordTypeAsync(RecordTypeRequest req, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "UPDATE dbo.cnf_record_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { req.Id, req.Name, req.Code, UpdatedBy = updatedBy });
    }

    public async Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<SyncTypeDto>(conn,
            "SELECT id, name, code, is_active FROM dbo.cnf_sync_types ORDER BY weight, name");
    }

    public async Task InsertSyncTypeAsync(SyncTypeRequest req, int createdBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "INSERT INTO dbo.cnf_sync_types (name, code, is_active, created, created_by) VALUES (@Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateSyncTypeAsync(SyncTypeRequest req, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "UPDATE dbo.cnf_sync_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { req.Id, req.Name, req.Code, UpdatedBy = updatedBy });
    }

    public async Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<ExportTypeDto>(conn,
            "SELECT id, name, code, exporter_class, is_active FROM dbo.cnf_export_types ORDER BY weight, name");
    }

    public async Task InsertExportTypeAsync(ExportTypeRequest req, int createdBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "INSERT INTO dbo.cnf_export_types (name, code, exporter_class, is_active, created, created_by) VALUES (@Name, @Code, @ExporterClass, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { req.Name, req.Code, req.ExporterClass, CreatedBy = createdBy });
    }

    public async Task UpdateExportTypeAsync(ExportTypeRequest req, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "UPDATE dbo.cnf_export_types SET name = @Name, code = @Code, exporter_class = @ExporterClass, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { req.Id, req.Name, req.Code, req.ExporterClass, UpdatedBy = updatedBy });
    }

    public async Task<IEnumerable<ContentTypeDocRowDto>> GetDocTypeContentTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<ContentTypeDocRowDto>(conn,
            @"SELECT id AS Id, name AS Name, code AS Code FROM dbo.cnf_content_types
              WHERE is_doc_type = 1 AND is_active = 1
              ORDER BY weight, name");
    }

    public async Task<IEnumerable<SeparateTypeRowDto>> GetSeparateTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<SeparateTypeRowDto>(conn,
            "SELECT id AS Id, name AS Name FROM dbo.cnf_separate_types ORDER BY name");
    }
}
