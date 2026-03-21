using Core.Domain.Entities.Cnf;
using Dapper;
using Shared.Contracts.Dtos;

namespace Infrastructure.Data.Repositories.Cnf;

public interface ICnfRepository
{
    // Config
    Task<IEnumerable<ConfigItemDto>> GetConfigsAsync(int channelId);
    Task UpsertConfigAsync(string key, string? value, int channelId, int updatedBy);

    // Content type
    Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync(int channelId);
    Task InsertContentTypeAsync(ContentTypeRequest req, int channelId, int createdBy);
    Task UpdateContentTypeAsync(ContentTypeRequest req, int channelId, int updatedBy);

    // Record type
    Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync(int channelId);
    Task InsertRecordTypeAsync(RecordTypeRequest req, int channelId, int createdBy);
    Task UpdateRecordTypeAsync(RecordTypeRequest req, int channelId, int updatedBy);

    // Sync type
    Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync(int channelId);
    Task InsertSyncTypeAsync(SyncTypeRequest req, int channelId, int createdBy);
    Task UpdateSyncTypeAsync(SyncTypeRequest req, int channelId, int updatedBy);

    // Export type
    Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync(int channelId);
    Task InsertExportTypeAsync(ExportTypeRequest req, int channelId, int createdBy);
    Task UpdateExportTypeAsync(ExportTypeRequest req, int channelId, int updatedBy);
}

public class CnfRepository : BaseRepository, ICnfRepository
{
    public CnfRepository(IDbConnectionFactory factory) : base(factory) { }

    // ---------- Config ----------
    public async Task<IEnumerable<ConfigItemDto>> GetConfigsAsync(int channelId)
    {
        using var conn = _factory.CreateCnfConnection();
        return await QueryAsync<ConfigItemDto>(conn,
            "SELECT id, channel_id, [key], value, group_name, [description] FROM core_cnf.configs WHERE channel_id = @ChannelId ORDER BY [key]",
            new { ChannelId = channelId });
    }

    public async Task UpsertConfigAsync(string key, string? value, int channelId, int updatedBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn, @"
            MERGE core_cnf.configs WITH (HOLDLOCK) AS t
            USING (SELECT @ChannelId AS cid, @Key AS cfg_key, @Value AS cfg_val) AS s
            ON (t.channel_id = s.cid AND t.[key] = s.cfg_key)
            WHEN MATCHED THEN UPDATE SET value = s.cfg_val
            WHEN NOT MATCHED THEN INSERT (channel_id, [key], value) VALUES (s.cid, s.cfg_key, s.cfg_val);",
            new { ChannelId = channelId, Key = key, Value = value });
    }

    // ---------- Content Type ----------
    public async Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync(int channelId)
    {
        using var conn = _factory.CreateCnfConnection();
        return await QueryAsync<ContentTypeDto>(conn,
            "SELECT id, channel_id, name, code, is_active FROM core_cnf.content_types WHERE channel_id = @ChannelId ORDER BY weight, name",
            new { ChannelId = channelId });
    }

    public async Task InsertContentTypeAsync(ContentTypeRequest req, int channelId, int createdBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "INSERT INTO core_cnf.content_types (channel_id, name, code, is_active, created, created_by) VALUES (@ChannelId, @Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { ChannelId = channelId, req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateContentTypeAsync(ContentTypeRequest req, int channelId, int updatedBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "UPDATE core_cnf.content_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id AND channel_id = @ChannelId",
            new { req.Id, req.Name, req.Code, ChannelId = channelId, UpdatedBy = updatedBy });
    }

    // ---------- Record Type ----------
    public async Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync(int channelId)
    {
        using var conn = _factory.CreateCnfConnection();
        return await QueryAsync<RecordTypeDto>(conn,
            "SELECT id, channel_id, name, code, is_active FROM core_cnf.record_types WHERE channel_id = @ChannelId ORDER BY weight, name",
            new { ChannelId = channelId });
    }

    public async Task InsertRecordTypeAsync(RecordTypeRequest req, int channelId, int createdBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "INSERT INTO core_cnf.record_types (channel_id, name, code, is_active, created, created_by) VALUES (@ChannelId, @Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { ChannelId = channelId, req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateRecordTypeAsync(RecordTypeRequest req, int channelId, int updatedBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "UPDATE core_cnf.record_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id AND channel_id = @ChannelId",
            new { req.Id, req.Name, req.Code, ChannelId = channelId, UpdatedBy = updatedBy });
    }

    // ---------- Sync Type ----------
    public async Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync(int channelId)
    {
        using var conn = _factory.CreateCnfConnection();
        return await QueryAsync<SyncTypeDto>(conn,
            "SELECT id, channel_id, name, code, is_active FROM core_cnf.sync_types WHERE channel_id = @ChannelId ORDER BY weight, name",
            new { ChannelId = channelId });
    }

    public async Task InsertSyncTypeAsync(SyncTypeRequest req, int channelId, int createdBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "INSERT INTO core_cnf.sync_types (channel_id, name, code, is_active, created, created_by) VALUES (@ChannelId, @Name, @Code, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { ChannelId = channelId, req.Name, req.Code, CreatedBy = createdBy });
    }

    public async Task UpdateSyncTypeAsync(SyncTypeRequest req, int channelId, int updatedBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "UPDATE core_cnf.sync_types SET name = @Name, code = @Code, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id AND channel_id = @ChannelId",
            new { req.Id, req.Name, req.Code, ChannelId = channelId, UpdatedBy = updatedBy });
    }

    // ---------- Export Type ----------
    public async Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync(int channelId)
    {
        using var conn = _factory.CreateCnfConnection();
        return await QueryAsync<ExportTypeDto>(conn,
            "SELECT id, channel_id, name, code, exporter_class, is_active FROM core_cnf.export_types WHERE channel_id = @ChannelId ORDER BY weight, name",
            new { ChannelId = channelId });
    }

    public async Task InsertExportTypeAsync(ExportTypeRequest req, int channelId, int createdBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "INSERT INTO core_cnf.export_types (channel_id, name, code, exporter_class, is_active, created, created_by) VALUES (@ChannelId, @Name, @Code, @ExporterClass, 1, SYSUTCDATETIME(), @CreatedBy)",
            new { ChannelId = channelId, req.Name, req.Code, req.ExporterClass, CreatedBy = createdBy });
    }

    public async Task UpdateExportTypeAsync(ExportTypeRequest req, int channelId, int updatedBy)
    {
        using var conn = _factory.CreateCnfConnection();
        await ExecuteAsync(conn,
            "UPDATE core_cnf.export_types SET name = @Name, code = @Code, exporter_class = @ExporterClass, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id AND channel_id = @ChannelId",
            new { req.Id, req.Name, req.Code, req.ExporterClass, ChannelId = channelId, UpdatedBy = updatedBy });
    }
}
