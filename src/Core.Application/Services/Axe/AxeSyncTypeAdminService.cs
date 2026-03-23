using Infrastructure.Data.Repositories.Stg;
using Microsoft.AspNetCore.Http;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services.Axe;

public interface IAxeSyncTypeAdminService
{
    Task<IReadOnlyList<DocTypeSyncListItemDto>> GetIndexAsync(int channelId, string? search);
    Task<SyncTypeEditPageDto?> GetEditPageAsync(int channelId, int id);
    Task<SyncTypeEditPageDto> GetCreatePageAsync(int channelId);
    Task<ApiResult> SaveAsync(int channelId, int userId, int id, IFormCollection form, bool isNew);
    Task<ApiResult> CloneAsync(int channelId, int userId, int id);
    Task<ApiResult> DeleteAsync(int channelId, int id);
}

public sealed class SyncTypeEditPageDto
{
    public DocTypeSyncFullDto Sync { get; init; } = null!;
    public IReadOnlyList<DocTypeFullDto> DocTypes { get; init; } = Array.Empty<DocTypeFullDto>();
    public IReadOnlyList<StgDocFieldDto> AllFields { get; init; } = Array.Empty<StgDocFieldDto>();
    public IReadOnlyList<DocTypeSyncSettingDto> Settings { get; init; } = Array.Empty<DocTypeSyncSettingDto>();
    public IReadOnlyList<CategoryTypeDto> CategoryTypes { get; init; } = Array.Empty<CategoryTypeDto>();
    public IReadOnlyList<PatternTypeDto> PatternTypes { get; init; } = Array.Empty<PatternTypeDto>();
}

public sealed class AxeSyncTypeAdminService : IAxeSyncTypeAdminService
{
    private readonly IAxeSyncTypeRepository _sync;
    private readonly IAxeDocTypeRepository _doc;
    private readonly IDocCatalogRepository _docCatalog;

    public AxeSyncTypeAdminService(IAxeSyncTypeRepository sync, IAxeDocTypeRepository doc, IDocCatalogRepository docCatalog)
    {
        _sync = sync;
        _doc = doc;
        _docCatalog = docCatalog;
    }

    public Task<IReadOnlyList<DocTypeSyncListItemDto>> GetIndexAsync(int channelId, string? search)
        => _sync.ListAsync(channelId, search);

    public async Task<SyncTypeEditPageDto?> GetEditPageAsync(int channelId, int id)
    {
        var row = await _sync.GetAsync(channelId, id);
        if (row == null) return null;
        return await BuildPageAsync(channelId, row);
    }

    public async Task<SyncTypeEditPageDto> GetCreatePageAsync(int channelId)
    {
        var row = new DocTypeSyncFullDto { Id = 0, ChannelId = channelId, Weight = 0 };
        return await BuildPageAsync(channelId, row);
    }

    private async Task<SyncTypeEditPageDto> BuildPageAsync(int channelId, DocTypeSyncFullDto sync)
    {
        var docTypes = await ListDocTypesForSelectAsync(channelId);
        var fields = await _doc.GetAllFieldsAsync();
        var settings = sync.Id > 0 ? await _sync.GetSettingsAsync(sync.Id) : Array.Empty<DocTypeSyncSettingDto>();
        var cats = await _doc.GetCategoryTypesAsync(channelId);
        var patterns = await _doc.GetPatternTypesAsync();
        return new SyncTypeEditPageDto
        {
            Sync = sync,
            DocTypes = docTypes,
            AllFields = fields,
            Settings = settings,
            CategoryTypes = cats,
            PatternTypes = patterns
        };
    }

    private Task<IReadOnlyList<DocTypeFullDto>> ListDocTypesForSelectAsync(int channelId)
        => _doc.ListDocTypesBriefAsync(channelId);

    public async Task<ApiResult> SaveAsync(int channelId, int userId, int id, IFormCollection form, bool isNew)
    {
        var name = AxeFormHelper.GetString(form, "Name")?.Trim() ?? "";
        if (string.IsNullOrEmpty(name))
            return ApiResult.Fail("Tên kiểu đồng bộ không được trống");
        if (await _sync.NameExistsAsync(channelId, name, isNew ? 0 : id))
            return ApiResult.Fail("Tên kiểu đồng bộ đã tồn tại");
        var weight = AxeFormHelper.GetInt(form, "Weight");
        if (weight < 0)
            return ApiResult.Fail("Thứ tự sắp xếp phải lớn hơn hoặc bằng 0");

        var row = new DocTypeSyncFullDto
        {
            Id = id,
            ChannelId = channelId,
            Name = name,
            Describe = AxeFormHelper.GetString(form, "Describe"),
            DocTypeId = AxeFormHelper.GetInt(form, "IDDoctype"),
            Format = AxeFormHelper.GetString(form, "Format"),
            Weight = weight,
            IsDefault = AxeFormHelper.GetBool(form, "IsDefault")
        };

        int syncId;
        if (isNew)
        {
            syncId = await _sync.InsertAsync(row, userId);
        }
        else
        {
            var ex = await _sync.GetAsync(channelId, id);
            if (ex == null)
                return ApiResult.Fail("Kiểu đồng bộ không tồn tại");
            row.Id = ex.Id;
            await _sync.UpdateAsync(row, userId);
            syncId = id;
        }

        var fields = await _doc.GetAllFieldsAsync();
        var cats = await _doc.GetCategoryTypesAsync(channelId);
        var current = await _sync.GetSettingsAsync(syncId);
        await _sync.DeleteSettingsAsync(syncId);
        var built = SyncTypeFieldSettingsBuilder.Build(fields, cats, syncId, form, current, true);
        await _sync.InsertSettingsAsync(built);

        return ApiResult.Ok(isNew ? "Tạo kiểu đồng bộ thành công" : "Cập nhật kiểu đồng bộ thành công");
    }

    public async Task<ApiResult> CloneAsync(int channelId, int userId, int id)
    {
        var src = await _sync.GetAsync(channelId, id);
        if (src == null)
            return ApiResult.Fail("Không tìm thấy cấu hình đồng bộ");
        var settings = await _sync.GetSettingsAsync(id);
        var i = 1;
        var name = $"{src.Name} ({i})";
        while (await _sync.NameExistsAsync(channelId, name, 0))
        {
            i++;
            name = $"{src.Name} ({i})";
        }
        src.Name = name;
        src.Id = 0;
        var newId = await _sync.InsertAsync(src, userId);
        var clones = settings.Select(s => new DocTypeSyncSettingDto
        {
            IdType = newId,
            IdField = s.IdField,
            IdPatternType = s.IdPatternType,
            Title = s.Title,
            Weight = s.Weight,
            IsCatalog = s.IsCatalog,
            PatternCustom = s.PatternCustom,
            FixValue = s.FixValue,
            MinValue = s.MinValue,
            MaxValue = s.MaxValue,
            MinLen = s.MinLen,
            MaxLen = s.MaxLen,
            IsRequired = s.IsRequired
        }).ToList();
        await _sync.InsertSettingsAsync(clones);
        return ApiResult.Ok("Sao chép cấu trúc đồng bộ thành công");
    }

    public async Task<ApiResult> DeleteAsync(int channelId, int id)
    {
        if (await _docCatalog.CountDocumentsBySyncTypeAsync(channelId, id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng cấu hình đồng bộ này.");
        await _sync.DeleteAsync(channelId, id);
        return ApiResult.Ok("Đã xóa");
    }
}
