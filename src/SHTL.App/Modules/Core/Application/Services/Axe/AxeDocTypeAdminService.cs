using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

public interface IAxeDocTypeAdminService
{
    Task<IReadOnlyList<DocTypeIndexRowDto>> GetIndexAsync(string? search);
    Task<DocTypeEditPageDto?> GetEditPageAsync(int id);
    Task<DocTypeEditPageDto> GetCreatePageAsync(int? contentTypeId);
    Task<ApiResult> SaveAsync(int userId, int id, IFormCollection form, bool isNew);
    Task<ApiResult> CloneAsync(int userId, int id);
    Task<ApiResult> DeleteAsync(int id);
    Task<DocTypeSortablePageDto?> GetSortablePageAsync(int id);
    Task<ApiResult> SaveSortableAsync(int docTypeId, IFormCollection form);
    Task<DocTypeSeparatePageDto?> GetSeparatePageAsync(int id);
    Task<ApiResult> SaveSeparateAsync(int docTypeId, IFormCollection form);
    Task<DocTypeOcrMapPageDto?> GetOcrMapPageAsync(int id, string? sampleFileKey);
    Task<ApiResult<DocTypeOcrSampleFileDto>> UploadOcrSampleFileAsync(int userId, int docTypeId, IFormFile file);
    Task<ApiResult> DeleteOcrSampleFileAsync(int docTypeId, string? sampleFileKey);
    bool TryResolveOcrSampleFileKey(int docTypeId, string? sampleFileKey, out string storageRelativePath);
    Task<ApiResult<DocTypeOcrZoneDto>> SaveOcrZoneAsync(int userId, int docTypeId, DocTypeOcrZoneSaveRequest request);
    Task<ApiResult> DeleteOcrZoneAsync(int docTypeId, long zoneId);
    Task<DocTypeOcrFixPageDto?> GetOcrFixPageAsync(int id);
    Task<ApiResult> SaveOcrFixFieldAsync(int userId, int docTypeId, IFormCollection form);
    Task<string> PreviewOcrFixAsync(int docTypeId, IFormCollection form);
    Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsAsync(int docTypeId);
    Task<ApiResult> UpdateFieldWeightAsync(int settingId, int weight);
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

public sealed class DocTypeOcrMapPageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<StgDocFieldSettingDto> FieldSettings { get; init; } = Array.Empty<StgDocFieldSettingDto>();
    public IReadOnlyDictionary<int, StgDocFieldDto> FieldById { get; init; } = new Dictionary<int, StgDocFieldDto>();
    public IReadOnlyList<DocTypeOcrZoneDto> Zones { get; init; } = Array.Empty<DocTypeOcrZoneDto>();
    public IReadOnlyList<DocTypeOcrSampleFileDto> SampleFiles { get; init; } = Array.Empty<DocTypeOcrSampleFileDto>();
    public string? SampleFileKey { get; init; }
}

public sealed class DocTypeOcrZoneSaveRequest
{
    public long Id { get; set; }
    public int FieldSettingId { get; set; }
    public int PageNumber { get; set; }
    public decimal XRatio { get; set; }
    public decimal YRatio { get; set; }
    public decimal WidthRatio { get; set; }
    public decimal HeightRatio { get; set; }
    public string? Label { get; set; }
    public string? SampleText { get; set; }
    public int Weight { get; set; }
}

public sealed class DocTypeOcrFixPageDto
{
    public DocTypeFullDto DocType { get; init; } = null!;
    public IReadOnlyList<StgDocFieldSettingDto> FieldSettings { get; init; } = Array.Empty<StgDocFieldSettingDto>();
    public IReadOnlyDictionary<int, StgDocFieldDto> FieldById { get; init; } = new Dictionary<int, StgDocFieldDto>();
    public IReadOnlyList<StgDocSoHoaOcrFixDto> OcrFixes { get; init; } = Array.Empty<StgDocSoHoaOcrFixDto>();
    public IReadOnlyDictionary<int, IReadOnlyList<int>> OcrFixRuleIdsByFieldId { get; init; } = new Dictionary<int, IReadOnlyList<int>>();
}

public sealed class AxeDocTypeAdminService : IAxeDocTypeAdminService
{
    private const string OcrSampleRootFolder = "SetOCR";

    private readonly IAxeDocTypeRepository _stg;
    private readonly ICnfRepository _cnf;
    private readonly IDocCatalogRepository _docCatalog;
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOpt;

    public AxeDocTypeAdminService(
        IAxeDocTypeRepository stg,
        ICnfRepository cnf,
        IDocCatalogRepository docCatalog,
        IStorageService storage,
        IOptions<StorageOptions> storageOpt)
    {
        _stg = stg;
        _cnf = cnf;
        _docCatalog = docCatalog;
        _storage = storage;
        _storageOpt = storageOpt.Value;
    }

    public async Task<IReadOnlyList<DocTypeIndexRowDto>> GetIndexAsync(string? search)
    {
        var rows = await _stg.ListDocTypesAsync(search);
        var list = rows.ToList();
        var ct = (await _cnf.GetDocTypeContentTypesAsync()).ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
        var sep = (await _cnf.GetSeparateTypesAsync()).ToDictionary(x => x.Id);
        foreach (var r in list)
        {
            var full = await _stg.GetDocTypeAsync(r.Id);
            if (full == null) continue;
            if (!string.IsNullOrEmpty(full.Code) && ct.TryGetValue(full.Code, out var ctn))
                r.ContentTypeName = ctn.Name;
            if (full.SeparateTypeId > 0 && sep.TryGetValue(full.SeparateTypeId, out var sn))
                r.SeparateTypeName = sn.Name;
        }
        return list;
    }

    public async Task<DocTypeEditPageDto?> GetEditPageAsync(int id)
    {
        var doc = await _stg.GetDocTypeAsync(id);
        if (doc == null) return null;
        return await BuildEditPageAsync(doc);
    }

    public async Task<DocTypeEditPageDto> GetCreatePageAsync(int? contentTypeId)
    {
        var doc = new DocTypeFullDto
        {
            Id = 0,
            ReviewStatus = 1,
            ParentId = 0,
            Parents = "",
            FieldQuantity = 0,
            Weight = 0
        };
        if (contentTypeId is > 0)
        {
            var all = await _cnf.GetDocTypeContentTypesAsync();
            var pick = all.FirstOrDefault(x => x.Id == contentTypeId.Value);
            if (pick != null)
                doc.Code = pick.Code;
        }
        return await BuildEditPageAsync(doc);
    }

    private async Task<DocTypeEditPageDto> BuildEditPageAsync(DocTypeFullDto doc)
    {
        var fields = await _stg.GetAllFieldsAsync();
        var settings = doc.Id > 0
            ? await _stg.GetFieldSettingsByTypeAsync(doc.Id)
            : Array.Empty<StgDocFieldSettingDto>();
        var cats = await _stg.GetCategoryTypesAsync();
        var patterns = await _stg.GetPatternTypesAsync();
        var groups = await _stg.GetFieldGroupsAsync();
        var ctypes = (await _cnf.GetDocTypeContentTypesAsync()).ToList();
        var seps = (await _cnf.GetSeparateTypesAsync()).ToList();
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

    public async Task<ApiResult> SaveAsync(int userId, int id, IFormCollection form, bool isNew)
    {
        try
        {
            var name = AxeFormHelper.GetString(form, "Name")?.Trim() ?? "";
            if (string.IsNullOrEmpty(name))
                return ApiResult.Fail("Tên loại tài liệu không được trống");

            var exclude = isNew ? 0 : id;
            if (await _stg.NameExistsAsync(name, exclude))
                return ApiResult.Fail("Tên loại tài liệu đã tồn tại");

            var weight = AxeFormHelper.GetInt(form, "Weight");
            if (weight < 0)
                return ApiResult.Fail("Thứ tự sắp xếp phải lớn hơn hoặc bằng 0");

            var doc = new DocTypeFullDto
            {
                Id = id,
                Name = name,
                Describe = AxeFormHelper.GetString(form, "Describe"),
                Code = "", // Không dùng nữa
                ParentId = 0, // Không dùng nữa
                Parents = "",
                IsDefault = false,
                IsOcrManualZoned = false, // Không dùng nữa
                FieldQuantity = 0, // Không dùng nữa
                SeparateTypeId = 0, // Không dùng nữa
                Weight = weight,
                ReviewStatus = 1
            };

            int docTypeId;
            if (isNew)
            {
                docTypeId = await _stg.InsertDocTypeAsync(doc, userId);
                doc.Id = docTypeId;
            }
            else
            {
                var existing = await _stg.GetDocTypeAsync(id);
                if (existing == null)
                    return ApiResult.Fail("Loại tài liệu không tồn tại");
                doc.Id = existing.Id;
                await _stg.UpdateDocTypeAsync(doc, userId);
                docTypeId = id;
            }

            var allFields = await _stg.GetAllFieldsAsync();
            var cats = await _stg.GetCategoryTypesAsync();
            var groups = await _stg.GetFieldGroupsAsync();
            var current = await _stg.GetFieldSettingsByTypeAsync(docTypeId);
            await _stg.DeleteFieldSettingsByTypeAsync(docTypeId);
            var built = DocTypeFieldSettingsBuilder.Build(allFields, cats, groups, docTypeId, form, current, true);
            await _stg.InsertFieldSettingsAsync(built);

            return ApiResult.Ok(isNew ? "Tạo loại tài liệu thành công" : "Cập nhật loại tài liệu thành công");
        }
        catch (Exception ex)
        {
            // Log the error for debugging
            return ApiResult.Fail($"Lỗi: {ex.Message}");
        }
    }

    public async Task<ApiResult> CloneAsync(int userId, int id)
    {
        var src = await _stg.GetDocTypeAsync(id);
        if (src == null)
            return ApiResult.Fail("Loại tài liệu không còn tồn tại");
        var settings = await _stg.GetFieldSettingsByTypeAsync(id);
        var i = 1;
        var name = $"{src.Name} ({i})";
        while (await _stg.NameExistsAsync(name, 0))
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

    public async Task<ApiResult> DeleteAsync(int id)
    {
        if (await _docCatalog.CountDocumentsByDocTypeAsync(id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng loại này.");
        await _stg.DeleteDocTypeAsync(id);
        return ApiResult.Ok("Đã xóa");
    }

    public async Task<DocTypeSortablePageDto?> GetSortablePageAsync(int id)
    {
        var doc = await _stg.GetDocTypeAsync(id);
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

    public async Task<ApiResult> SaveSortableAsync(int docTypeId, IFormCollection form)
    {
        var doc = await _stg.GetDocTypeAsync(docTypeId);
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

    public async Task<DocTypeSeparatePageDto?> GetSeparatePageAsync(int id)
    {
        var doc = await _stg.GetDocTypeAsync(id);
        if (doc == null) return null;
        var seps = await _stg.GetSeparatesAsync(id);
        return new DocTypeSeparatePageDto { DocType = doc, Separates = seps };
    }

    public async Task<ApiResult> SaveSeparateAsync(int docTypeId, IFormCollection form)
    {
        var doc = await _stg.GetDocTypeAsync(docTypeId);
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

        await _stg.ReplaceSeparatesAsync(docTypeId, rows, 0);
        return ApiResult.Ok(rows.Count > 0 ? "Đã lưu cấu hình phân tách" : "Đã xóa cấu hình phân tách");
    }

    public async Task<DocTypeOcrMapPageDto?> GetOcrMapPageAsync(int id, string? sampleFileKey)
    {
        var doc = await _stg.GetDocTypeAsync(id);
        if (doc == null) return null;
        var settings = (await _stg.GetFieldSettingsByTypeAsync(id)).OrderBy(x => x.Weight).ToList();
        var fields = await _stg.GetAllFieldsAsync();
        var samples = ListOcrSampleFiles(id);
        var pickedSampleKey = TryResolveOcrSampleFileKey(id, sampleFileKey, out var resolvedKey)
            ? resolvedKey
            : samples.FirstOrDefault()?.FileKey;
        var fieldById = (fields ?? new List<StgDocFieldDto>())
            .GroupBy(f => f.Id)
            .ToDictionary(g => g.Key, g => g.First());
        return new DocTypeOcrMapPageDto
        {
            DocType = doc,
            FieldSettings = settings,
            FieldById = fieldById,
            Zones = await _stg.GetOcrZonesAsync(id),
            SampleFiles = samples,
            SampleFileKey = pickedSampleKey
        };
    }

    public async Task<ApiResult<DocTypeOcrSampleFileDto>> UploadOcrSampleFileAsync(int userId, int docTypeId, IFormFile file)
    {
        var doc = await _stg.GetDocTypeAsync(docTypeId);
        if (doc == null)
            return ApiResult<DocTypeOcrSampleFileDto>.Fail("Loai tai lieu khong ton tai");
        if (file == null || file.Length == 0)
            return ApiResult<DocTypeOcrSampleFileDto>.Fail("File PDF mau khong hop le");
        if (file.Length > _storageOpt.MaxFileSizeBytes)
            return ApiResult<DocTypeOcrSampleFileDto>.Fail("File vuot qua dung luong cho phep");

        var ext = Path.GetExtension(file.FileName);
        if (!IsPdfExtension(ext))
            return ApiResult<DocTypeOcrSampleFileDto>.Fail("Chi chap nhan file PDF");

        await using var stream = file.OpenReadStream();
        var stored = await _storage.SaveFileAsync(stream, file.FileName, BuildOcrSampleFolder(docTypeId));
        var sample = new DocTypeOcrSampleFileDto
        {
            FileKey = stored,
            FileName = Path.GetFileName(stored)
        };
        return ApiResult<DocTypeOcrSampleFileDto>.Ok(sample, "Da tai PDF mau len storage");
    }

    public async Task<ApiResult> DeleteOcrSampleFileAsync(int docTypeId, string? sampleFileKey)
    {
        var doc = await _stg.GetDocTypeAsync(docTypeId);
        if (doc == null)
            return ApiResult.Fail("Loại tài liệu không tồn tại");
        if (!TryResolveOcrSampleFileKey(docTypeId, sampleFileKey, out var storagePath))
            return ApiResult.Fail("File PDF mẫu không hợp lệ");

        var deleted = await _storage.DeleteFileAsync(storagePath);
        return deleted ? ApiResult.Ok("Đã xóa PDF mẫu") : ApiResult.Fail("Không xóa được file PDF mẫu");
    }

    public bool TryResolveOcrSampleFileKey(int docTypeId, string? sampleFileKey, out string storageRelativePath)
    {
        storageRelativePath = string.Empty;
        if (string.IsNullOrWhiteSpace(sampleFileKey))
            return false;

        var normalized = sampleFileKey.Trim().Replace('\\', '/');
        var prefix = $"{BuildOcrSampleFolder(docTypeId)}/";
        if (!normalized.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            if (normalized.Contains('/') || normalized.Contains('\\'))
                return false;
            normalized = prefix + normalized;
        }

        if (!IsPdfExtension(Path.GetExtension(normalized)))
            return false;

        var fullPath = Path.GetFullPath(Path.Combine(_storageOpt.RootPath, normalized.Replace('/', Path.DirectorySeparatorChar)));
        var root = Path.GetFullPath(_storageOpt.RootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var rootPrefix = root + Path.DirectorySeparatorChar;
        if (!fullPath.Equals(root, StringComparison.OrdinalIgnoreCase)
            && !fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            return false;

        if (!File.Exists(fullPath))
            return false;

        storageRelativePath = normalized;
        return true;
    }

    private IReadOnlyList<DocTypeOcrSampleFileDto> ListOcrSampleFiles(int docTypeId)
    {
        var folder = BuildOcrSampleFolder(docTypeId);
        var fullDir = Path.GetFullPath(Path.Combine(_storageOpt.RootPath, folder.Replace('/', Path.DirectorySeparatorChar)));
        var root = Path.GetFullPath(_storageOpt.RootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var rootPrefix = root + Path.DirectorySeparatorChar;
        if (!fullDir.Equals(root, StringComparison.OrdinalIgnoreCase)
            && !fullDir.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            return Array.Empty<DocTypeOcrSampleFileDto>();
        if (!Directory.Exists(fullDir))
            return Array.Empty<DocTypeOcrSampleFileDto>();

        return Directory.EnumerateFiles(fullDir, "*.*", SearchOption.TopDirectoryOnly)
            .Where(path => IsPdfExtension(Path.GetExtension(path)))
            .Select(path =>
            {
                var fileName = Path.GetFileName(path);
                return new DocTypeOcrSampleFileDto
                {
                    FileKey = $"{folder}/{fileName}".Replace('\\', '/'),
                    FileName = fileName
                };
            })
            .OrderByDescending(x => x.FileName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string BuildOcrSampleFolder(int docTypeId) => $"{OcrSampleRootFolder}/{docTypeId}";

    private static bool IsPdfExtension(string? extension)
    {
        var normalized = (extension ?? string.Empty).Trim();
        if (normalized.Length == 0)
            return false;
        if (!normalized.StartsWith('.'))
            normalized = "." + normalized;
        return string.Equals(normalized, ".pdf", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<ApiResult<DocTypeOcrZoneDto>> SaveOcrZoneAsync(int userId, int docTypeId, DocTypeOcrZoneSaveRequest request)
    {
        var doc = await _stg.GetDocTypeAsync(docTypeId);
        if (doc == null)
            return ApiResult<DocTypeOcrZoneDto>.Fail("Loai tai lieu khong ton tai");

        var settings = await _stg.GetFieldSettingsByTypeAsync(docTypeId);
        var setting = settings.FirstOrDefault(x => x.Id == request.FieldSettingId);
        if (setting == null)
            return ApiResult<DocTypeOcrZoneDto>.Fail("Truong cau hinh khong hop le");
        if (request.PageNumber <= 0)
            return ApiResult<DocTypeOcrZoneDto>.Fail("Trang PDF khong hop le");
        if (request.WidthRatio <= 0 || request.HeightRatio <= 0)
            return ApiResult<DocTypeOcrZoneDto>.Fail("Vung OCR phai co kich thuoc");

        var existingZones = await _stg.GetOcrZonesAsync(docTypeId);
        if (existingZones.Any(z => z.FieldSettingId == request.FieldSettingId && z.Id != request.Id))
            return ApiResult<DocTypeOcrZoneDto>.Fail("Trường cấu hình này đã được gán cho vùng OCR khác.");

        static decimal ClampRatio(decimal value) => Math.Min(1m, Math.Max(0m, value));
        var row = new DocTypeOcrZoneDto
        {
            Id = request.Id,
            DocTypeId = docTypeId,
            FieldSettingId = request.FieldSettingId,
            FieldId = setting.IdField,
            PageNumber = request.PageNumber,
            XRatio = ClampRatio(request.XRatio),
            YRatio = ClampRatio(request.YRatio),
            WidthRatio = ClampRatio(request.WidthRatio),
            HeightRatio = ClampRatio(request.HeightRatio),
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim(),
            SampleText = string.IsNullOrWhiteSpace(request.SampleText) ? null : request.SampleText.Trim(),
            Weight = Math.Max(0, request.Weight)
        };
        row.Id = await _stg.UpsertOcrZoneAsync(row, userId);
        return ApiResult<DocTypeOcrZoneDto>.Ok(row, "Đã lưu vùng OCR");
    }

    public async Task<ApiResult> DeleteOcrZoneAsync(int docTypeId, long zoneId)
    {
        if (zoneId <= 0)
            return ApiResult.Fail("Vung OCR khong hop le");
        var affected = await _stg.DeleteOcrZoneAsync(docTypeId, zoneId);
        return affected > 0 ? ApiResult.Ok("Đã xóa vùng OCR") : ApiResult.Fail("Không tìm thấy vùng OCR");
    }

    public async Task<DocTypeOcrFixPageDto?> GetOcrFixPageAsync(int id)
    {
        var doc = await _stg.GetDocTypeAsync(id);
        if (doc == null) return null;
        var settings = (await _stg.GetFieldSettingsByTypeAsync(id)).Where(x => !x.IsCatalog).ToList();
        var fields = await _stg.GetAllFieldsAsync();
        var map = fields.ToDictionary(f => f.Id);
        var fixes = await _stg.GetOcrFixesAsync();
        var byField = new Dictionary<int, IReadOnlyList<int>>();
        foreach (var s in settings)
        {
            var ids = await _stg.GetOcrFixIdsForFieldAsync(id, s.IdField);
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

    public async Task<ApiResult> SaveOcrFixFieldAsync(int userId, int docTypeId, IFormCollection form)
    {
        var fieldId = AxeFormHelper.GetInt(form, "IDField");
        var isUse = AxeFormHelper.GetBool(form, "IsUse");
        var ids = ParseIntList(form, $"FieldOCRFix_{fieldId}");
        await _stg.SetFieldOcrFixFlagAsync(docTypeId, fieldId, isUse, userId);
        await _stg.ReplaceDocTypeOcrFixesAsync(docTypeId, fieldId, ids, isUse, userId);
        return ApiResult.Ok("Đã lưu cấu hình OCR");
    }

    public async Task<string> PreviewOcrFixAsync(int docTypeId, IFormCollection form)
    {
        var input = AxeFormHelper.GetString(form, "Input") ?? "";
        var fieldId = AxeFormHelper.GetInt(form, "IDField");
        var ids = ParseIntList(form, $"FieldOCRFix_{fieldId}");
        var fixes = (await _stg.GetOcrFixesAsync()).Where(x => ids.Contains(x.Id)).OrderBy(x => ids.IndexOf(x.Id)).ToList();
        var types = (await _stg.GetOcrFixTypesAsync()).ToDictionary(x => x.Id, x => x.Code);
        return AxeOcrFixEngine.Apply(input, fixes, types);
    }

    public async Task<IReadOnlyList<StgDocFieldSettingDto>> GetFieldSettingsAsync(int docTypeId)
    {
        return await _stg.GetFieldSettingsByTypeAsync(docTypeId);
    }

    public async Task<ApiResult> UpdateFieldWeightAsync(int settingId, int weight)
    {
        try
        {
            await _stg.UpdateFieldSettingWeightByIdAsync(settingId, weight);
            return ApiResult.Ok("Đã cập nhật thứ tự");
        }
        catch (Exception ex)
        {
            return ApiResult.Fail($"Lỗi: {ex.Message}");
        }
    }
}
