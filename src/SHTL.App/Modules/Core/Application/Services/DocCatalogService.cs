using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IDocCatalogService
{
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(string? search);
    Task<DocTypeListItemDto?> GetDocTypeAsync(int id);
    Task<ApiResult> SaveDocTypeAsync(DocTypeEditRequest req, ICurrentUser user);
    Task<ApiResult> DeleteDocTypeAsync(int id);

    Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(string? search);
    Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int id);
    Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesForSelectAsync();
    Task<ApiResult> SaveDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, ICurrentUser user);
    Task<ApiResult> DeleteDocTypeSyncTypeAsync(int id);
}

public class DocCatalogService : IDocCatalogService
{
    private readonly IDocCatalogRepository _repo;

    public DocCatalogService(IDocCatalogRepository repo)
    {
        _repo = repo;
    }

    public Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesAsync(string? search)
        => _repo.ListDocTypesAsync(search);

    public Task<DocTypeListItemDto?> GetDocTypeAsync(int id)
        => _repo.GetDocTypeAsync(id);

    public async Task<ApiResult> SaveDocTypeAsync(DocTypeEditRequest req, ICurrentUser user)
    {
        if (req.Id == 0)
        {
            await _repo.InsertDocTypeAsync(req, user.Id);
            return ApiResult.Ok("Đã tạo loại tài liệu");
        }

        var n = await _repo.UpdateDocTypeAsync(req, user.Id);
        return n > 0 ? ApiResult.Ok("Đã cập nhật loại tài liệu") : ApiResult.Fail("Không tìm thấy loại tài liệu");
    }

    public async Task<ApiResult> DeleteDocTypeAsync(int id)
    {
        if (await _repo.CountDocumentsByDocTypeAsync(id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng loại này.");

        await _repo.DeleteSyncTypesByDocTypeAsync(id);
        var n = await _repo.DeleteDocTypeAsync(id);
        return n > 0 ? ApiResult.Ok("Đã xóa loại tài liệu") : ApiResult.Fail("Không tìm thấy loại tài liệu");
    }

    public Task<IReadOnlyList<DocTypeSyncListItemDto>> ListDocTypeSyncTypesAsync(string? search)
        => _repo.ListDocTypeSyncTypesAsync(search);

    public Task<DocTypeSyncListItemDto?> GetDocTypeSyncTypeAsync(int id)
        => _repo.GetDocTypeSyncTypeAsync(id);

    public Task<IReadOnlyList<DocTypeListItemDto>> ListDocTypesForSelectAsync()
        => _repo.ListDocTypesAsync(null);

    public async Task<ApiResult> SaveDocTypeSyncTypeAsync(DocTypeSyncEditRequest req, ICurrentUser user)
    {
        var docType = await _repo.GetDocTypeAsync(req.DocTypeId);
        if (docType == null)
            return ApiResult.Fail("Loại tài liệu không hợp lệ");

        if (req.Id == 0)
        {
            await _repo.InsertDocTypeSyncTypeAsync(req, user.Id);
            return ApiResult.Ok("Đã tạo loại đồng bộ");
        }

        var n = await _repo.UpdateDocTypeSyncTypeAsync(req, user.Id);
        return n > 0 ? ApiResult.Ok("Đã cập nhật loại đồng bộ") : ApiResult.Fail("Không tìm thấy loại đồng bộ");
    }

    public async Task<ApiResult> DeleteDocTypeSyncTypeAsync(int id)
    {
        if (await _repo.CountDocumentsBySyncTypeAsync(id) > 0)
            return ApiResult.Fail("Không thể xóa: đang có tài liệu dùng cấu hình đồng bộ này.");

        var n = await _repo.DeleteDocTypeSyncTypeAsync(id);
        return n > 0 ? ApiResult.Ok("Đã xóa loại đồng bộ") : ApiResult.Fail("Không tìm thấy loại đồng bộ");
    }
}
