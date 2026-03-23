using Core.Domain.Contracts;
using Infrastructure.Data.Repositories.Stg;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IDocCatalogService
{
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(int channelId, string? search);
    Task<DocTypeListItemDto?> GetDocTypeAsync(int channelId, int id);
    Task<ApiResult> SaveDocTypeAsync(DocTypeEditRequest req, int channelId, ICurrentUser user);
    Task<ApiResult> DeleteDocTypeAsync(int id, int channelId);

    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(int channelId, string? search);
    Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int channelId, int id);
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesForSelectAsync(int channelId);
    Task<ApiResult> SaveDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, ICurrentUser user);
    Task<ApiResult> DeleteDocTypeSyncTypeAsync(int id, int channelId);
}

public class DocCatalogService : IDocCatalogService
{
    private readonly IDocCatalogRepository _repo;

    public DocCatalogService(IDocCatalogRepository repo)
    {
        _repo = repo;
    }

    public Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(int channelId, string? search)
        => _repo.ListDocTypesAsync(channelId, search);

    public Task<DocTypeListItemDto?> GetDocTypeAsync(int channelId, int id)
        => _repo.GetDocTypeAsync(channelId, id);

    public async Task<ApiResult> SaveDocTypeAsync(DocTypeEditRequest req, int channelId, ICurrentUser user)
    {
        if (req.Id == 0)
        {
            await _repo.InsertDocTypeAsync(req, channelId, user.Id);
            return ApiResult.Ok("Đã tạo loại tài liệu");
        }

        var n = await _repo.UpdateDocTypeAsync(req, channelId, user.Id);
        return n > 0 ? ApiResult.Ok("Đã cập nhật loại tài liệu") : ApiResult.Fail("Không tìm thấy loại tài liệu");
    }

    public async Task<ApiResult> DeleteDocTypeAsync(int id, int channelId)
    {
        if (await _repo.CountDocumentsByDocTypeAsync(channelId, id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng loại này.");

        await _repo.DeleteSyncTypesByDocTypeAsync(channelId, id);
        var n = await _repo.DeleteDocTypeAsync(channelId, id);
        return n > 0 ? ApiResult.Ok("Đã xóa loại tài liệu") : ApiResult.Fail("Không tìm thấy loại tài liệu");
    }

    public Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(int channelId, string? search)
        => _repo.ListDocTypeSyncTypesAsync(channelId, search);

    public Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int channelId, int id)
        => _repo.GetDocTypeSyncTypeAsync(channelId, id);

    public Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesForSelectAsync(int channelId)
        => _repo.ListDocTypesAsync(channelId, null);

    public async Task<ApiResult> SaveDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, int channelId, ICurrentUser user)
    {
        var docType = await _repo.GetDocTypeAsync(channelId, req.DocTypeId);
        if (docType == null)
            return ApiResult.Fail("Loại tài liệu không hợp lệ");

        if (req.Id == 0)
        {
            await _repo.InsertDocTypeSyncTypeAsync(req, channelId, user.Id);
            return ApiResult.Ok("Đã tạo loại đồng bộ");
        }

        var n = await _repo.UpdateDocTypeSyncTypeAsync(req, channelId, user.Id);
        return n > 0 ? ApiResult.Ok("Đã cập nhật loại đồng bộ") : ApiResult.Fail("Không tìm thấy loại đồng bộ");
    }

    public async Task<ApiResult> DeleteDocTypeSyncTypeAsync(int id, int channelId)
    {
        if (await _repo.CountDocumentsBySyncTypeAsync(channelId, id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng cấu hình đồng bộ này.");

        var n = await _repo.DeleteDocTypeSyncTypeAsync(channelId, id);
        return n > 0 ? ApiResult.Ok("Đã xóa loại đồng bộ") : ApiResult.Fail("Không tìm thấy loại đồng bộ");
    }
}
