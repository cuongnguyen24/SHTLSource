using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IAxeDocTypeRepository
{
    Task<IReadOnlyList<DocTypeFullDto>> ListDocTypesBriefAsync();
    Task<IReadOnlyList<DocTypeIndexRowDto>> ListDocTypesAsync(string? search);
    Task<DocTypeFullDto?> GetDocTypeAsync(int id);
    Task<bool> NameExistsAsync(string name, int excludeId);
    Task<int> InsertDocTypeAsync(DocTypeFullDto row, int userId);
    Task<int> UpdateDocTypeAsync(DocTypeFullDto row, int userId);
    Task DeleteDocTypeAsync(int id);

    Task<IReadOnlyList<StgDocFieldDto>> GetAllFieldsAsync();
    Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsByTypeAsync(int docTypeId);
    Task DeleteFieldSettingsByTypeAsync(int docTypeId);
    Task InsertFieldSettingsAsync(IReadOnlyList<StgDocFieldSettingDto> rows);

    Task<IReadOnlyList<CategoryTypeDto>> GetCategoryTypesAsync();
    Task<IReadOnlyList<PatternTypeDto>> GetPatternTypesAsync();
    Task<IReadOnlyList<StgDocFieldGroupDto>> GetFieldGroupsAsync();

    Task<IReadOnlyList<DocTypeSeparateDto>> GetSeparatesAsync(int docTypeId);
    Task ReplaceSeparatesAsync(int docTypeId, IReadOnlyList<DocTypeSeparateDto> rows, int userId);

    Task UpdateFieldSettingWeightsAsync(IReadOnlyList<StgDocFieldSettingDto> rows);
    Task UpdateFieldSettingWeightByIdAsync(int settingId, int weight);

    Task<IReadOnlyList<StgDocSoHoaOcrFixDto>> GetOcrFixesAsync();
    Task<IReadOnlyList<StgDocSoHoaOcrFixTypeDto>> GetOcrFixTypesAsync();
    Task<IReadOnlyList<int>> GetOcrFixIdsForFieldAsync(int docTypeId, int fieldId);
    Task ReplaceDocTypeOcrFixesAsync(int docTypeId, int fieldId, IReadOnlyList<int> ocrFixIds, bool isUse, int userId);
    Task SetFieldOcrFixFlagAsync(int docTypeId, int fieldId, bool isUse, int userId);
}

public class AxeDocTypeRepository : BaseRepository, IAxeDocTypeRepository
{
    public AxeDocTypeRepository(AppDbContext db) : base(db) { }

    public async Task<IReadOnlyList<DocTypeFullDto>> ListDocTypesBriefAsync()
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<DocTypeFullDto>(conn, @"
            SELECT id AS Id, name AS Name, code AS Code, [describe] AS Describe,
                   parent_id AS ParentId, parents AS Parents, is_default AS IsDefault,
                   is_ocr_manual_zoned AS IsOcrManualZoned, field_quantity AS FieldQuantity,
                   separate_type_id AS SeparateTypeId, weight AS Weight, review_status AS ReviewStatus
            FROM dbo.stg_doc_types ORDER BY weight, name");
        return rows.ToList();
    }

    public async Task<IReadOnlyList<DocTypeIndexRowDto>> ListDocTypesAsync(string? search)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            SELECT d.id AS Id, d.name AS Name, d.[describe] AS Describe, d.review_status AS ReviewStatus
            FROM dbo.stg_doc_types d
            WHERE 1 = 1";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (d.name LIKE @Like OR d.[describe] LIKE @Like OR d.code LIKE @Like)";
        sql += " ORDER BY d.weight, d.name";
        var like = string.IsNullOrWhiteSpace(search) ? null : "%" + search.Trim() + "%";
        return (await QueryAsync<DocTypeIndexRowDto>(conn, sql, new { Like = like })).ToList();
    }

    public async Task<DocTypeFullDto?> GetDocTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<DocTypeFullDto>(conn, @"
            SELECT id AS Id, name AS Name, code AS Code, [describe] AS Describe,
                   parent_id AS ParentId, parents AS Parents, is_default AS IsDefault,
                   is_ocr_manual_zoned AS IsOcrManualZoned, field_quantity AS FieldQuantity,
                   separate_type_id AS SeparateTypeId, weight AS Weight, review_status AS ReviewStatus
            FROM dbo.stg_doc_types WHERE id = @Id",
            new { Id = id });
    }

    public async Task<bool> NameExistsAsync(string name, int excludeId)
    {
        var conn = await OpenConnectionAsync();
        var n = await ExecuteScalarAsync<int>(conn,
            @"SELECT COUNT(1) FROM dbo.stg_doc_types
              WHERE name = @Name AND id <> @ExcludeId",
            new { Name = name, ExcludeId = excludeId });
        return n > 0;
    }

    public async Task<int> InsertDocTypeAsync(DocTypeFullDto row, int userId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_types
            (name, code, [describe], parent_id, parents, is_default, is_ocr_manual_zoned,
             field_quantity, separate_type_id, extractor_type_id, weight, review_status, created, created_by, updated, updated_by)
            VALUES
            (@Name, @Code, @Describe, @ParentId, @Parents, @IsDefault, @IsOcrManualZoned,
             @FieldQuantity, @SeparateTypeId, 0, @Weight, @ReviewStatus, SYSUTCDATETIME(), @UserId, SYSUTCDATETIME(), @UserId);
            SELECT CAST(SCOPE_IDENTITY() AS INT);";
        return await ExecuteScalarAsync<int>(conn, sql, new
        {
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
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.stg_doc_types SET
                name = @Name, code = @Code, [describe] = @Describe, parent_id = @ParentId, parents = @Parents,
                is_default = @IsDefault, is_ocr_manual_zoned = @IsOcrManualZoned, field_quantity = @FieldQuantity,
                separate_type_id = @SeparateTypeId, weight = @Weight, review_status = @ReviewStatus,
                updated = SYSUTCDATETIME(), updated_by = @UserId
            WHERE id = @Id",
            new
            {
                row.Id,
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

    public async Task DeleteDocTypeAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_field_settings WHERE id_type = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_separates WHERE id_doctype = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_ocr_fixes WHERE id_doctype = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_type_sync_types WHERE doc_type_id = @Id", new { Id = id });
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_types WHERE id = @Id", new { Id = id });
    }

    public async Task<IReadOnlyList<StgDocFieldDto>> GetAllFieldsAsync()
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<StgDocFieldDto>(conn,
            @"SELECT id AS Id, name AS Name, title AS Title, is_required AS IsRequired, is_active AS IsActive,
                     is_record AS IsRecord, datatype AS Datatype, c_class AS CClass
              FROM dbo.stg_doc_fields ORDER BY id");
        return rows.ToList();
    }

    public async Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsByTypeAsync(int docTypeId)
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<StgDocFieldSettingDto>(conn, @"
            SELECT id AS Id, id_type AS IdType, id_field AS IdField, id_pattern_type AS IdPatternType,
                   id_category_type AS IdCategoryType, id_field_group AS IdFieldGroup, ocr_type AS OcrType,
                   i_type AS IType, i_row AS IRow, i_col AS ICol, title AS Title, weight AS Weight,
                   is_multi AS IsMulti, is_search AS IsSearch, is_catalog AS IsCatalog, is_catalog_main AS IsCatalogMain,
                   pattern_custom AS PatternCustom, fix_value AS FixValue, min_value AS MinValue, max_value AS MaxValue,
                   min_len AS MinLen, max_len AS MaxLen, is_required AS IsRequired, is_read_only AS IsReadOnly,
                   is_upper_case AS IsUpperCase, is_capitalize AS IsCapitalize, format AS Format, is_ocr_fix AS IsOcrFix
            FROM dbo.stg_doc_field_settings WHERE id_type = @Id ORDER BY weight",
            new { Id = docTypeId });
        return rows.ToList();
    }

    public async Task DeleteFieldSettingsByTypeAsync(int docTypeId)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn, "DELETE FROM dbo.stg_doc_field_settings WHERE id_type = @Id", new { Id = docTypeId });
    }

    public async Task InsertFieldSettingsAsync(IReadOnlyList<StgDocFieldSettingDto> rows)
    {
        if (rows.Count == 0) return;
        var conn = await OpenConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.stg_doc_field_settings
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

    public async Task<IReadOnlyList<CategoryTypeDto>> GetCategoryTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<CategoryTypeDto>(conn,
            "SELECT id AS Id, name AS Name FROM dbo.stg_category_types ORDER BY weight, name");
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PatternTypeDto>> GetPatternTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return (await QueryAsync<PatternTypeDto>(conn, "SELECT id AS Id, name AS Name FROM dbo.stg_pattern_types ORDER BY name")).ToList();
    }

    public async Task<IReadOnlyList<StgDocFieldGroupDto>> GetFieldGroupsAsync()
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<StgDocFieldGroupDto>(conn,
            @"SELECT id AS Id, name AS Name, group_name AS GroupName, weight AS Weight, id_parent AS IdParent
              FROM dbo.stg_doc_field_groups ORDER BY weight, name");
        return rows.ToList();
    }

    public async Task<IReadOnlyList<DocTypeSeparateDto>> GetSeparatesAsync(int docTypeId)
    {
        var conn = await OpenConnectionAsync();
        return (await QueryAsync<DocTypeSeparateDto>(conn,
            @"SELECT id AS Id, x AS X, y AS Y, width AS Width, height AS Height, weight AS Weight
              FROM dbo.stg_doc_type_separates WHERE id_doctype = @D ORDER BY weight",
            new { D = docTypeId })).ToList();
    }

    public async Task ReplaceSeparatesAsync(int docTypeId, IReadOnlyList<DocTypeSeparateDto> rows, int userId)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "DELETE FROM dbo.stg_doc_type_separates WHERE id_doctype = @D",
            new { D = docTypeId });
        const string ins = @"
            INSERT INTO dbo.stg_doc_type_separates (id_doctype, x, y, width, height, weight)
            VALUES (@DocTypeId, @X, @Y, @Width, @Height, @Weight)";
        var w = 0;
        foreach (var r in rows)
        {
            await ExecuteAsync(conn, ins, new
            {
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
        var conn = await OpenConnectionAsync();
        foreach (var r in rows)
        {
            await ExecuteAsync(conn,
                "UPDATE dbo.stg_doc_field_settings SET weight = @W, is_search = @S WHERE id = @Id",
                new { r.Id, W = r.Weight, S = r.IsSearch });
        }
    }

    public async Task UpdateFieldSettingWeightByIdAsync(int settingId, int weight)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            "UPDATE dbo.stg_doc_field_settings SET weight = @W WHERE id = @Id",
            new { W = weight, Id = settingId });
    }

    public async Task<IReadOnlyList<StgDocSoHoaOcrFixDto>> GetOcrFixesAsync()
    {
        var conn = await OpenConnectionAsync();
        return (await QueryAsync<StgDocSoHoaOcrFixDto>(conn, @"
            SELECT id AS Id, name AS Name, type AS Type, from_str AS FromStr, to_str AS ToStr,
                   from_position AS FromPosition, to_position AS ToPosition, excepts AS Excepts
            FROM dbo.stg_doc_sohoa_ocr_fixes ORDER BY name")).ToList();
    }

    public async Task<IReadOnlyList<StgDocSoHoaOcrFixTypeDto>> GetOcrFixTypesAsync()
    {
        var conn = await OpenConnectionAsync();
        return (await QueryAsync<StgDocSoHoaOcrFixTypeDto>(conn,
            "SELECT id AS Id, code AS Code FROM dbo.stg_doc_sohoa_ocr_fix_types")).ToList();
    }

    public async Task<IReadOnlyList<int>> GetOcrFixIdsForFieldAsync(int docTypeId, int fieldId)
    {
        var conn = await OpenConnectionAsync();
        var rows = await QueryAsync<int>(conn,
            @"SELECT id_ocr_fix FROM dbo.stg_doc_type_ocr_fixes
              WHERE id_doctype = @D AND id_field = @F ORDER BY weight",
            new { D = docTypeId, F = fieldId });
        return rows.ToList();
    }

    public async Task ReplaceDocTypeOcrFixesAsync(int docTypeId, int fieldId, IReadOnlyList<int> ocrFixIds, bool isUse, int userId)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            @"DELETE FROM dbo.stg_doc_type_ocr_fixes WHERE id_doctype = @D AND id_field = @F",
            new { D = docTypeId, F = fieldId });
        if (!isUse || ocrFixIds.Count == 0) return;
        const string ins = @"
            INSERT INTO dbo.stg_doc_type_ocr_fixes (id_doctype, id_field, id_ocr_fix, weight)
            VALUES (@D, @F, @Fix, @W)";
        for (var i = 0; i < ocrFixIds.Count; i++)
            await ExecuteAsync(conn, ins, new { D = docTypeId, F = fieldId, Fix = ocrFixIds[i], W = i + 1 });
    }

    public async Task SetFieldOcrFixFlagAsync(int docTypeId, int fieldId, bool isUse, int userId)
    {
        var conn = await OpenConnectionAsync();
        await ExecuteAsync(conn,
            @"UPDATE dbo.stg_doc_field_settings SET is_ocr_fix = @U
              WHERE id_type = @T AND id_field = @F",
            new { T = docTypeId, F = fieldId, U = isUse });
    }
}
