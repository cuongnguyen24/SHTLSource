using Core.Domain.Contracts;
using Infrastructure.Data.Repositories.Cnf;
using Infrastructure.Data.Repositories.Stg;
using Microsoft.AspNetCore.Http;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services.Axe;

public interface IAxeDocTypeAdminService
{
    Task<IReadOnlyList<DocTypeIndexRowDto>> GetIndexAsync(int channelId, string? search);
    Task<DocTypeEditPageDto?> GetEditPageAsync(int channelId, int id);
    Task<DocTypeEditPageDto> GetCreatePageAsync(int channelId, int? contentTypeId);
    Task<ApiResult> SaveAsync(int channelId, int userId, int id, IFormCollection form, bool isNew);
    Task<ApiResult> CloneAsync(int channelId, int userId, int id);
    Task<ApiResult> DeleteAsync(int channelId, int id);
    Task<DocTypeSortablePageDto?> GetSortablePageAsync(int channelId, int id);
    Task<ApiResult> SaveSortableAsync(int channelId, int docTypeId, IFormCollection form);
    Task<DocTypeSeparatePageDto?> GetSeparatePageAsync(int channelId, int id);
    Task<ApiResult> SaveSeparateAsync(int channelId, int docTypeId, IFormCollection form);
    Task<DocTypeOcrFixPageDto?> GetOcrFixPageAsync(int channelId, int id);
    Task<ApiResult> SaveOcrFixFieldAsync(int channelId, int userId, int docTypeId, IFormCollection form);
    Task<string> PreviewOcrFixAsync(int channelId, int docTypeId, IFormCollection form);
}

public sealed class DocTypeEditPageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<StgDocFieldDto> AllFields { get; init; } = Array.Empty<StgDocFieldDto>();
    public IReadOnlyList<StgDocFieldSettingDto> Settings { get; init; } = Array.Empty<StgDocFieldSettingDto>();
    public IReadOnlyList<CategoryTypeDto> CategoryTypes { get; init; } = Array.Empty<CategoryTypeDto>();
    public IReadOnlyList<PatternTypeDto> PatternTypes { get; init; } = Array.Empty<PatternTypeDto>();
    public IReadOnlyList<StgDocFieldGroupDto> FieldGroups { get; init; } = Array.Empty<StgDocFieldGroupDto>();
    public IReadOnlyList<ContentTypeDocRowDto> ContentTypes { get; init; } = Array.Empty<ContentTypeDocRowDto>();
    public IReadOnlyList<SeparateTypeRowDto> SeparateTypes { get; init; } = Array.Empty<SeparateTypeRowDto>();
}

public sealed class DocTypeSortablePageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<StgDocFieldSettingDto> Settings { get; init; } = Array.Empty<StgDocFieldSettingDto>();
    public IReadOnlyDictionary<int, StgDocFieldDto> FieldById { get; init; } = new Dictionary<int, StgDocFieldDto>();
}

public sealed class DocTypeSeparatePageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<DocTypeSeparateDto> Separates { get; init; } = Array.Empty<DocTypeSeparateDto>();
}

public sealed class DocTypeOcrFixPageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<StgDocFieldSettingDto> FieldSettings { get; init; } = Array.Empty<StgDocFieldSettingDto>();
    public IReadOnlyDictionary<int, StgDocFieldDto> FieldById { get; init; } = new Dictionary<int, StgDocFieldDto>();
    public IReadOnlyList<StgDocSoHoaOcrFixDto> OcrFixes { get; init; } = Array.Empty<StgDocSoHoaOcrFixDto>();
    /// <summary>Thứ tự rule OCR đã gán cho từng trường (IdField = id bảng stg_doc_fields).</summary>
    public IReadOnlyDictionary<int, IReadOnlyList<int>> OcrFixRuleIdsByFieldId { get; init; } = new Dictionary<int, IReadOnlyList<int>>();
}

public sealed class AxeDocTypeAdminService : IAxeDocTypeAdminService
{
    private readonly IAxeDocTypeRepository _stg;
    private readonly ICnfRepository _cnf;
    private readonly IDocCatalogRepository _docCatalog;

    public AxeDocTypeAdminService(IAxeDocTypeRepository stg, ICnfRepository cnf, IDocCatalogRepository docCatalog)
    {
        _stg = stg;
        _cnf = cnf;
        _docCatalog = docCatalog;
    }

    public async Task<IReadOnlyList<DocTypeIndexRowDto>> GetIndexAsync(int channelId, string? search)
    {
        var rows = await _stg.ListDocTypesAsync(channelId, search);
        var list = rows.ToList();
        var ct = (await _cnf.GetDocTypeContentTypesAsync(channelId)).ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
        var sep = (await _cnf.GetSeparateTypesAsync(channelId)).ToDictionary(x => x.Id);
        foreach (var r in list)
        {
            var full = await _stg.GetDocTypeAsync(channelId, r.Id);
            if (full == null) continue;
            if (!string.IsNullOrEmpty(full.Code) && ct.TryGetValue(full.Code, out var ctn))
                r.ContentTypeName = ctn.Name;
            if (full.SeparateTypeId > 0 && sep.TryGetValue(full.SeparateTypeId, out var sn))
                r.SeparateTypeName = sn.Name;
        }
        return list;
    }

    public async Task<DocTypeEditPageDto?> GetEditPageAsync(int channelId, int id)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, id);
        if (doc == null) return null;
        return await BuildEditPageAsync(channelId, doc);
    }

    public async Task<DocTypeEditPageDto> GetCreatePageAsync(int channelId, int? contentTypeId)
    {
        var doc = new DocTypeFullDto
        {
            Id = 0,
            ChannelId = channelId,
            ReviewStatus = 1,
            ParentId = 0,
            Parents = "",
            FieldQuantity = 0,
            Weight = 0
        };
        if (contentTypeId is > 0)
        {
            var all = await _cnf.GetDocTypeContentTypesAsync(channelId);
            var pick = all.FirstOrDefault(x => x.Id == contentTypeId.Value);
            if (pick != null)
                doc.Code = pick.Code;
        }
        return await BuildEditPageAsync(channelId, doc);
    }

    private async Task<DocTypeEditPageDto> BuildEditPageAsync(int channelId, DocTypeFullDto doc)
    {
        var fields = await _stg.GetAllFieldsAsync();
        var settings = doc.Id > 0
            ? await _stg.GetFieldSettingsByTypeAsync(doc.Id)
            : Array.Empty<StgDocFieldSettingDto>();
        var cats = await _stg.GetCategoryTypesAsync(channelId);
        var patterns = await _stg.GetPatternTypesAsync();
        var groups = await _stg.GetFieldGroupsAsync(channelId);
        var ctypes = (await _cnf.GetDocTypeContentTypesAsync(channelId)).ToList();
        var seps = (await _cnf.GetSeparateTypesAsync(channelId)).ToList();
        return new DocTypeEditPageDto
        {
            DocType = doc,
            AllFields = fields,
            Settings = settings,
            CategoryTypes = cats,
            PatternTypes = patterns,
            FieldGroups = groups,
            ContentTypes = ctypes,
            SeparateTypes = seps
        };
    }

    public async Task<ApiResult> SaveAsync(int channelId, int userId, int id, IFormCollection form, bool isNew)
    {
        var name = AxeFormHelper.GetString(form, "Name")?.Trim() ?? "";
        if (string.IsNullOrEmpty(name))
            return ApiResult.Fail("Tên loại tài liệu không được trống");

        var exclude = isNew ? 0 : id;
        if (await _stg.NameExistsAsync(channelId, name, exclude))
            return ApiResult.Fail("Tên loại tài liệu đã tồn tại");

        var weight = AxeFormHelper.GetInt(form, "Weight");
        if (weight < 0)
            return ApiResult.Fail("Thứ tự sắp xếp phải lớn hơn hoặc bằng 0");

        var fieldQty = AxeFormHelper.GetInt(form, "FieldQuantity");
        if (fieldQty < 0)
            return ApiResult.Fail("Số trường nhập phải lớn hơn hoặc bằng 0");

        var doc = new DocTypeFullDto
        {
            Id = id,
            ChannelId = channelId,
            Name = name,
            Describe = AxeFormHelper.GetString(form, "Describe"),
            Code = AxeFormHelper.GetString(form, "Code"),
            ParentId = AxeFormHelper.GetInt(form, "Parent"),
            Parents = "",
            IsDefault = false,
            IsOcrManualZoned = AxeFormHelper.GetBool(form, "IsOCRManualZoned"),
            FieldQuantity = fieldQty,
            SeparateTypeId = AxeFormHelper.GetInt(form, "IDSeparateType"),
            Weight = weight,
            ReviewStatus = 1
        };

        var parent = await _stg.GetDocTypeAsync(channelId, doc.ParentId);
        if (parent != null)
        {
            doc.Parents = string.IsNullOrEmpty(parent.Parents) ? parent.Id.ToString() : $"{parent.Parents},{parent.Id}";
        }

        int docTypeId;
        if (isNew)
        {
            docTypeId = await _stg.InsertDocTypeAsync(doc, userId);
            doc.Id = docTypeId;
        }
        else
        {
            var existing = await _stg.GetDocTypeAsync(channelId, id);
            if (existing == null)
                return ApiResult.Fail("Loại tài liệu không tồn tại");
            doc.Id = existing.Id;
            await _stg.UpdateDocTypeAsync(doc, userId);
            docTypeId = id;
        }

        var allFields = await _stg.GetAllFieldsAsync();
        var cats = await _stg.GetCategoryTypesAsync(channelId);
        var current = await _stg.GetFieldSettingsByTypeAsync(docTypeId);
        await _stg.DeleteFieldSettingsByTypeAsync(docTypeId);
        var built = DocTypeFieldSettingsBuilder.Build(allFields, cats, docTypeId, form, current, true);
        await _stg.InsertFieldSettingsAsync(built);

        return ApiResult.Ok(isNew ? "Tạo loại tài liệu thành công" : "Cập nhật loại tài liệu thành công");
    }

    public async Task<ApiResult> CloneAsync(int channelId, int userId, int id)
    {
        var src = await _stg.GetDocTypeAsync(channelId, id);
        if (src == null)
            return ApiResult.Fail("Loại tài liệu không còn tồn tại");
        var settings = await _stg.GetFieldSettingsByTypeAsync(id);
        var i = 1;
        var name = $"{src.Name} ({i})";
        while (await _stg.NameExistsAsync(channelId, name, 0))
        {
            i++;
            name = $"{src.Name} ({i})";
        }
        src.Id = 0;
        src.Name = name;
        var newId = await _stg.InsertDocTypeAsync(src, userId);
        var clones = settings.Select(s => new StgDocFieldSettingDto
        {
            IdType = newId,
            IdField = s.IdField,
            IdPatternType = s.IdPatternType,
            IdCategoryType = s.IdCategoryType,
            IdFieldGroup = s.IdFieldGroup,
            OcrType = s.OcrType,
            IType = s.IType,
            IRow = s.IRow,
            ICol = s.ICol,
            Title = s.Title,
            Weight = s.Weight,
            IsMulti = s.IsMulti,
            IsSearch = s.IsSearch,
            IsCatalog = s.IsCatalog,
            IsCatalogMain = s.IsCatalogMain,
            PatternCustom = s.PatternCustom,
            FixValue = s.FixValue,
            MinValue = s.MinValue,
            MaxValue = s.MaxValue,
            MinLen = s.MinLen,
            MaxLen = s.MaxLen,
            IsRequired = s.IsRequired,
            IsReadOnly = s.IsReadOnly,
            IsUpperCase = s.IsUpperCase,
            IsCapitalize = s.IsCapitalize,
            Format = s.Format,
            IsOcrFix = s.IsOcrFix
        }).ToList();
        await _stg.InsertFieldSettingsAsync(clones);
        return ApiResult.Ok("Sao chép loại tài liệu thành công");
    }

    public async Task<ApiResult> DeleteAsync(int channelId, int id)
    {
        if (await _docCatalog.CountDocumentsByDocTypeAsync(channelId, id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng loại này.");
        await _stg.DeleteDocTypeAsync(channelId, id);
        return ApiResult.Ok("Đã xóa");
    }

    public async Task<DocTypeSortablePageDto?> GetSortablePageAsync(int channelId, int id)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, id);
        if (doc == null) return null;
        var settings = (await _stg.GetFieldSettingsByTypeAsync(id)).OrderBy(x => x.Weight).ToList();
        if (settings.Count == 0)
            return null;
        var fields = await _stg.GetAllFieldsAsync();
        var map = fields.ToDictionary(f => f.Id);
        return new DocTypeSortablePageDto
        {
            DocType = doc,
            Settings = settings,
            FieldById = map
        };
    }

    public async Task<ApiResult> SaveSortableAsync(int channelId, int docTypeId, IFormCollection form)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, docTypeId);
        if (doc == null)
            return ApiResult.Fail("Loại tài liệu không tồn tại");
        var settings = (await _stg.GetFieldSettingsByTypeAsync(docTypeId)).ToList();
        if (settings.Count == 0)
            return ApiResult.Fail("Không có trường để sắp xếp");

        var tickIds = ParseIntList(form, "Ticks");
        var orderIds = ParseIntList(form, "IDFieldSettings");
        foreach (var s in settings)
        {
            s.IsSearch = tickIds.Contains(s.Id);
            s.Weight = orderIds.Count > 0 ? Math.Max(0, orderIds.IndexOf(s.Id)) : s.Weight;
        }
        await _stg.UpdateFieldSettingWeightsAsync(settings);
        return ApiResult.Ok("Đã lưu thứ tự trường");
    }

    private static List<int> ParseIntList(IFormCollection form, string key)
    {
        if (!form.TryGetValue(key, out var v) || v.Count == 0)
            return new List<int>();
        var parts = new List<int>();
        foreach (var segment in v)
        {
            foreach (var t in (segment ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (int.TryParse(t, out var n) && n > 0)
                    parts.Add(n);
            }
        }
        return parts;
    }

    public async Task<DocTypeSeparatePageDto?> GetSeparatePageAsync(int channelId, int id)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, id);
        if (doc == null) return null;
        var seps = await _stg.GetSeparatesAsync(channelId, id);
        return new DocTypeSeparatePageDto { DocType = doc, Separates = seps };
    }

    public async Task<ApiResult> SaveSeparateAsync(int channelId, int docTypeId, IFormCollection form)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, docTypeId);
        if (doc == null)
            return ApiResult.Fail("Loại tài liệu không tồn tại");

        var xs = ParseIntList(form, "X");
        var ys = ParseIntList(form, "Y");
        var ws = ParseIntList(form, "W");
        var hs = ParseIntList(form, "H");
        var n = Math.Min(Math.Min(xs.Count, ys.Count), Math.Min(ws.Count, hs.Count));
        var rows = new List<DocTypeSeparateDto>();
        for (var i = 0; i < n; i++)
            rows.Add(new DocTypeSeparateDto { X = xs[i], Y = ys[i], Width = ws[i], Height = hs[i] });

        await _stg.ReplaceSeparatesAsync(channelId, docTypeId, rows, 0);
        return ApiResult.Ok(rows.Count > 0 ? "Đã lưu cấu hình phân tách" : "Đã xóa cấu hình phân tách");
    }

    public async Task<DocTypeOcrFixPageDto?> GetOcrFixPageAsync(int channelId, int id)
    {
        var doc = await _stg.GetDocTypeAsync(channelId, id);
        if (doc == null) return null;
        var settings = (await _stg.GetFieldSettingsByTypeAsync(id)).Where(x => !x.IsCatalog).ToList();
        var fields = await _stg.GetAllFieldsAsync();
        var map = fields.ToDictionary(f => f.Id);
        var fixes = await _stg.GetOcrFixesAsync(channelId);
        var byField = new Dictionary<int, IReadOnlyList<int>>();
        foreach (var s in settings)
        {
            var ids = await _stg.GetOcrFixIdsForFieldAsync(channelId, id, s.IdField);
            byField[s.IdField] = ids;
        }
        return new DocTypeOcrFixPageDto
        {
            DocType = doc,
            FieldSettings = settings,
            FieldById = map,
            OcrFixes = fixes,
            OcrFixRuleIdsByFieldId = byField
        };
    }

    public async Task<ApiResult> SaveOcrFixFieldAsync(int channelId, int userId, int docTypeId, IFormCollection form)
    {
        var fieldId = AxeFormHelper.GetInt(form, "IDField");
        var isUse = AxeFormHelper.GetBool(form, "IsUse");
        var ids = ParseIntList(form, $"FieldOCRFix_{fieldId}");
        await _stg.SetFieldOcrFixFlagAsync(docTypeId, fieldId, isUse, userId);
        await _stg.ReplaceDocTypeOcrFixesAsync(channelId, docTypeId, fieldId, ids, isUse, userId);
        return ApiResult.Ok("Đã lưu cấu hình OCR");
    }

    public async Task<string> PreviewOcrFixAsync(int channelId, int docTypeId, IFormCollection form)
    {
        var input = AxeFormHelper.GetString(form, "Input") ?? "";
        var fieldId = AxeFormHelper.GetInt(form, "IDField");
        var ids = ParseIntList(form, $"FieldOCRFix_{fieldId}");
        var fixes = (await _stg.GetOcrFixesAsync(channelId)).Where(x => ids.Contains(x.Id)).OrderBy(x => ids.IndexOf(x.Id)).ToList();
        var types = (await _stg.GetOcrFixTypesAsync()).ToDictionary(x => x.Id, x => x.Code);
        return AxeOcrFixEngine.Apply(input, fixes, types);
    }
}
