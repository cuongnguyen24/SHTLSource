using Shared.Contracts.Dtos;

namespace Infrastructure.Data.Repositories.Stg;

public interface IAxeDocTypeRepository
{
    Task<IReadOnlyList<DocTypeFullDto>> ListDocTypesBriefAsync(int channelId);
    Task<IReadOnlyList<DocTypeIndexRowDto>> ListDocTypesAsync(int channelId, string? search);
    Task<DocTypeFullDto?> GetDocTypeAsync(int channelId, int id);
    Task<bool> NameExistsAsync(int channelId, string name, int excludeId);
    Task<int> InsertDocTypeAsync(DocTypeFullDto row, int userId);
    Task<int> UpdateDocTypeAsync(DocTypeFullDto row, int userId);
    Task DeleteDocTypeAsync(int channelId, int id);

    Task<IReadOnlyList<StgDocFieldDto>> GetAllFieldsAsync();
    Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsByTypeAsync(int docTypeId);
    Task DeleteFieldSettingsByTypeAsync(int docTypeId);
    Task InsertFieldSettingsAsync(IReadOnlyList<StgDocFieldSettingDto> rows);

    Task<IReadOnlyList<CategoryTypeDto>> GetCategoryTypesAsync(int channelId);
    Task<IReadOnlyList<PatternTypeDto>> GetPatternTypesAsync();
    Task<IReadOnlyList<StgDocFieldGroupDto>> GetFieldGroupsAsync(int channelId);

    Task<IReadOnlyList<DocTypeSeparateDto>> GetSeparatesAsync(int channelId, int docTypeId);
    Task ReplaceSeparatesAsync(int channelId, int docTypeId, IReadOnlyList<DocTypeSeparateDto> rows, int userId);

    Task UpdateFieldSettingWeightsAsync(IReadOnlyList<StgDocFieldSettingDto> rows);

    Task<IReadOnlyList<StgDocSoHoaOcrFixDto>> GetOcrFixesAsync(int channelId);
    Task<IReadOnlyList<StgDocSoHoaOcrFixTypeDto>> GetOcrFixTypesAsync();
    Task<IReadOnlyList<int>> GetOcrFixIdsForFieldAsync(int channelId, int docTypeId, int fieldId);
    Task ReplaceDocTypeOcrFixesAsync(int channelId, int docTypeId, int fieldId, IReadOnlyList<int> ocrFixIds, bool isUse, int userId);
    Task SetFieldOcrFixFlagAsync(int docTypeId, int fieldId, bool isUse, int userId);
}

public class AxeDocTypeRepository : BaseRepository, IAxeDocTypeRepository
{
    public AxeDocTypeRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<IReadOnlyList<DocTypeFullDto>> ListDocTypesBriefAsync(int channelId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<DocTypeFullDto>(conn, @"
            SELECT id AS Id, channel_id AS ChannelId, name AS Name, code AS Code, [describe] AS Describe,
                   parent_id AS ParentId, parents AS Parents, is_default AS IsDefault,
                   is_ocr_manual_zoned AS IsOcrManualZoned, field_quantity AS FieldQuantity,
                   separate_type_id AS SeparateTypeId, weight AS Weight, review_status AS ReviewStatus
            FROM core_stg.doc_types WHERE channel_id = @C ORDER BY weight, name", new { C = channelId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<DocTypeIndexRowDto>> ListDocTypesAsync(int channelId, string? search)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            SELECT d.id AS Id, d.name AS Name, d.[describe] AS Describe, d.review_status AS ReviewStatus
            FROM core_stg.doc_types d
            WHERE d.channel_id = @ChannelId";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (d.name LIKE @Like OR d.[describe] LIKE @Like OR d.code LIKE @Like)";
        sql += " ORDER BY d.weight, d.name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        return (await QueryAsync<DocTypeIndexRowDto>(conn, sql, new { ChannelId = channelId, Like = like })).ToList();
    }

    public async Task<DocTypeFullDto?> GetDocTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<DocTypeFullDto>(conn, @"
            SELECT id AS Id, channel_id AS ChannelId, name AS Name, code AS Code, [describe] AS Describe,
                   parent_id AS ParentId, parents AS Parents, is_default AS IsDefault,
                   is_ocr_manual_zoned AS IsOcrManualZoned, field_quantity AS FieldQuantity,
                   separate_type_id AS SeparateTypeId, weight AS Weight, review_status AS ReviewStatus
            FROM core_stg.doc_types WHERE channel_id = @ChannelId AND id = @Id",
            new { ChannelId = channelId, Id = id });
    }

    public async Task<bool> NameExistsAsync(int channelId, string name, int excludeId)
    {
        using var conn = _factory.CreateStgConnection();
        var n = await ExecuteScalarAsync<int>(conn,
            @"SELECT COUNT(1) FROM core_stg.doc_types
              WHERE channel_id = @ChannelId AND name = @Name AND id <> @ExcludeId",
            new { ChannelId = channelId, Name = name, ExcludeId = excludeId });
        return n > 0;
    }

    public async Task<int> InsertDocTypeAsync(DocTypeFullDto row, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.doc_types
            (channel_id, name, code, [describe], parent_id, parents, is_default, is_ocr_manual_zoned,
             field_quantity, separate_type_id, weight, review_status, created, created_by)
            VALUES
            (@ChannelId, @Name, @Code, @Describe, @ParentId, @Parents, @IsDefault, @IsOcrManualZoned,
             @FieldQuantity, @SeparateTypeId, @Weight, @ReviewStatus, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
            row.ChannelId,
            row.Name,
            row.Code,
            row.Describe,
            row.ParentId,
            row.Parents,
            row.IsDefault,
            row.IsOcrManualZoned,
            row.FieldQuantity,
            SeparateTypeId = row.SeparateTypeId,
            row.Weight,
            row.ReviewStatus,
            UserId = userId
        });
    }

    public async Task<int> UpdateDocTypeAsync(DocTypeFullDto row, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn, @"
            UPDATE core_stg.doc_types SET
                name = @Name, code = @Code, [describe] = @Describe, parent_id = @ParentId, parents = @Parents,
                is_default = @IsDefault, is_ocr_manual_zoned = @IsOcrManualZoned, field_quantity = @FieldQuantity,
                separate_type_id = @SeparateTypeId, weight = @Weight, review_status = @ReviewStatus,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id AND channel_id = @ChannelId",
            new
            {
                row.Id,
                row.ChannelId,
                row.Name,
                row.Code,
                row.Describe,
                row.ParentId,
                row.Parents,
                row.IsDefault,
                row.IsOcrManualZoned,
                row.FieldQuantity,
                SeparateTypeId = row.SeparateTypeId,
                row.Weight,
                row.ReviewStatus,
                UserId = userId
            });
    }

    public async Task DeleteDocTypeAsync(int channelId, int id)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn, "DELETE FROM core_stg.stg_doc_field_settings WHERE id_type = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM core_stg.stg_doc_type_separates WHERE channel_id = @C AND id_doctype = @Id", new { C = channelId, Id = id });
        await ExecuteAsync(conn, "DELETE FROM core_stg.stg_doc_type_ocr_fixes WHERE channel_id = @C AND id_doctype = @Id", new { C = channelId, Id = id });
        await ExecuteAsync(conn, "DELETE FROM core_stg.doc_type_sync_types WHERE channel_id = @C AND doc_type_id = @Id", new { C = channelId, Id = id });
        await ExecuteAsync(conn, "DELETE FROM core_stg.doc_types WHERE channel_id = @C AND id = @Id", new { C = channelId, Id = id });
    }

    public async Task<IReadOnlyList<StgDocFieldDto>> GetAllFieldsAsync()
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<StgDocFieldDto>(conn,
            @"SELECT id AS Id, name AS Name, title AS Title, is_required AS IsRequired, is_active AS IsActive,
                     is_record AS IsRecord, datatype AS Datatype, c_class AS CClass
              FROM core_stg.stg_doc_fields ORDER BY id");
        return rows.ToList();
    }

    public async Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsByTypeAsync(int docTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<StgDocFieldSettingDto>(conn, @"
            SELECT id AS Id, id_type AS IdType, id_field AS IdField, id_pattern_type AS IdPatternType,
                   id_category_type AS IdCategoryType, id_field_group AS IdFieldGroup, ocr_type AS OcrType,
                   i_type AS IType, i_row AS IRow, i_col AS ICol, title AS Title, weight AS Weight,
                   is_multi AS IsMulti, is_search AS IsSearch, is_catalog AS IsCatalog, is_catalog_main AS IsCatalogMain,
                   pattern_custom AS PatternCustom, fix_value AS FixValue, min_value AS MinValue, max_value AS MaxValue,
                   min_len AS MinLen, max_len AS MaxLen, is_required AS IsRequired, is_read_only AS IsReadOnly,
                   is_upper_case AS IsUpperCase, is_capitalize AS IsCapitalize, format AS Format, is_ocr_fix AS IsOcrFix
            FROM core_stg.stg_doc_field_settings WHERE id_type = @Id ORDER BY weight",
            new { Id = docTypeId });
        return rows.ToList();
    }

    public async Task DeleteFieldSettingsByTypeAsync(int docTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn, "DELETE FROM core_stg.stg_doc_field_settings WHERE id_type = @Id", new { Id = docTypeId });
    }

    public async Task InsertFieldSettingsAsync(IReadOnlyList<StgDocFieldSettingDto> rows)
    {
        if (rows.Count == 0) return;
        using var conn = _factory.CreateStgConnection();
        const string sql = @"
            INSERT INTO core_stg.stg_doc_field_settings
            (id_type, id_field, id_pattern_type, id_category_type, id_field_group, ocr_type, i_type, i_row, i_col,
             title, weight, is_multi, is_search, is_catalog, is_catalog_main, pattern_custom, fix_value, min_value, max_value,
             min_len, max_len, is_required, is_read_only, is_upper_case, is_capitalize, format, is_ocr_fix)
            VALUES
            (@IdType, @IdField, @IdPatternType, @IdCategoryType, @IdFieldGroup, @OcrType, @IType, @IRow, @ICol,
             @Title, @Weight, @IsMulti, @IsSearch, @IsCatalog, @IsCatalogMain, @PatternCustom, @FixValue, @MinValue, @MaxValue,
             @MinLen, @MaxLen, @IsRequired, @IsReadOnly, @IsUpperCase, @IsCapitalize, @Format, @IsOcrFix)";
        foreach (var r in rows)
            await ExecuteAsync(conn, sql, r);
    }

    public async Task<IReadOnlyList<CategoryTypeDto>> GetCategoryTypesAsync(int channelId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<CategoryTypeDto>(conn,
            "SELECT id AS Id, channel_id AS ChannelId, name AS Name FROM core_stg.category_types WHERE channel_id IN (0, @C) ORDER BY weight, name",
            new { C = channelId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PatternTypeDto>> GetPatternTypesAsync()
    {
        using var conn = _factory.CreateStgConnection();
        return (await QueryAsync<PatternTypeDto>(conn, "SELECT id AS Id, name AS Name FROM core_stg.pattern_types ORDER BY name")).ToList();
    }

    public async Task<IReadOnlyList<StgDocFieldGroupDto>> GetFieldGroupsAsync(int channelId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<StgDocFieldGroupDto>(conn,
            @"SELECT id AS Id, channel_id AS ChannelId, name AS Name, group_name AS GroupName, weight AS Weight, id_parent AS IdParent
              FROM core_stg.stg_doc_field_groups WHERE channel_id IN (0, @C) ORDER BY weight, name",
            new { C = channelId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<DocTypeSeparateDto>> GetSeparatesAsync(int channelId, int docTypeId)
    {
        using var conn = _factory.CreateStgConnection();
        return (await QueryAsync<DocTypeSeparateDto>(conn,
            @"SELECT id AS Id, x AS X, y AS Y, width AS Width, height AS Height, weight AS Weight
              FROM core_stg.stg_doc_type_separates WHERE channel_id = @C AND id_doctype = @D ORDER BY weight",
            new { C = channelId, D = docTypeId })).ToList();
    }

    public async Task ReplaceSeparatesAsync(int channelId, int docTypeId, IReadOnlyList<DocTypeSeparateDto> rows, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn,
            "DELETE FROM core_stg.stg_doc_type_separates WHERE channel_id = @C AND id_doctype = @D",
            new { C = channelId, D = docTypeId });
        const string ins = @"
            INSERT INTO core_stg.stg_doc_type_separates (channel_id, id_doctype, x, y, width, height, weight)
            VALUES (@ChannelId, @DocTypeId, @X, @Y, @Width, @Height, @Weight)";
        var w = 0;
        foreach (var r in rows)
        {
            await ExecuteAsync(conn, ins, new
            {
                ChannelId = channelId,
                DocTypeId = docTypeId,
                r.X,
                r.Y,
                Width = r.Width,
                Height = r.Height,
                Weight = w++
            });
        }
    }

    public async Task UpdateFieldSettingWeightsAsync(IReadOnlyList<StgDocFieldSettingDto> rows)
    {
        using var conn = _factory.CreateStgConnection();
        foreach (var r in rows)
        {
            await ExecuteAsync(conn,
                "UPDATE core_stg.stg_doc_field_settings SET weight = @W, is_search = @S WHERE id = @Id",
                new { r.Id, W = r.Weight, S = r.IsSearch });
        }
    }

    public async Task<IReadOnlyList<StgDocSoHoaOcrFixDto>> GetOcrFixesAsync(int channelId)
    {
        using var conn = _factory.CreateStgConnection();
        return (await QueryAsync<StgDocSoHoaOcrFixDto>(conn, @"
            SELECT id AS Id, name AS Name, type AS Type, from_str AS FromStr, to_str AS ToStr,
                   from_position AS FromPosition, to_position AS ToPosition, excepts AS Excepts
            FROM core_stg.stg_doc_sohoa_ocr_fixes WHERE channel_id IN (0, @C) ORDER BY name",
            new { C = channelId })).ToList();
    }

    public async Task<IReadOnlyList<StgDocSoHoaOcrFixTypeDto>> GetOcrFixTypesAsync()
    {
        using var conn = _factory.CreateStgConnection();
        return (await QueryAsync<StgDocSoHoaOcrFixTypeDto>(conn,
            "SELECT id AS Id, code AS Code FROM core_stg.stg_doc_sohoa_ocr_fix_types")).ToList();
    }

    public async Task<IReadOnlyList<int>> GetOcrFixIdsForFieldAsync(int channelId, int docTypeId, int fieldId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await QueryAsync<int>(conn,
            @"SELECT id_ocr_fix FROM core_stg.stg_doc_type_ocr_fixes
              WHERE channel_id = @C AND id_doctype = @D AND id_field = @F ORDER BY weight",
            new { C = channelId, D = docTypeId, F = fieldId });
        return rows.ToList();
    }

    public async Task ReplaceDocTypeOcrFixesAsync(int channelId, int docTypeId, int fieldId, IReadOnlyList<int> ocrFixIds, bool isUse, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn,
            @"DELETE FROM core_stg.stg_doc_type_ocr_fixes WHERE channel_id = @C AND id_doctype = @D AND id_field = @F",
            new { C = channelId, D = docTypeId, F = fieldId });
        if (!isUse || ocrFixIds.Count == 0) return;
        const string ins = @"
            INSERT INTO core_stg.stg_doc_type_ocr_fixes (channel_id, id_doctype, id_field, id_ocr_fix, weight)
            VALUES (@C, @D, @F, @Fix, @W)";
        for (var i = 0; i < ocrFixIds.Count; i++)
            await ExecuteAsync(conn, ins, new { C = channelId, D = docTypeId, F = fieldId, Fix = ocrFixIds[i], W = i + 1 });
    }

    public async Task SetFieldOcrFixFlagAsync(int docTypeId, int fieldId, bool isUse, int userId)
    {
        using var conn = _factory.CreateStgConnection();
        await ExecuteAsync(conn,
            @"UPDATE core_stg.stg_doc_field_settings SET is_ocr_fix = @U
              WHERE id_type = @T AND id_field = @F",
            new { T = docTypeId, F = fieldId, U = isUse });
    }
}
