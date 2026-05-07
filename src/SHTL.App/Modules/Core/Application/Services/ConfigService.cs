using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IConfigService
{
    Task<IEnumerable<ConfigItemDto>> GetSystemConfigsAsync();
    Task<ApiResult> SaveConfigAsync(SaveConfigRequest req, ICurrentUser currentUser);

    Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync();
    Task<ApiResult> SaveContentTypeAsync(ContentTypeRequest req, ICurrentUser currentUser);

    Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync();
    Task<ApiResult> SaveRecordTypeAsync(RecordTypeRequest req, ICurrentUser currentUser);

    Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync();
    Task<ApiResult> SaveSyncTypeAsync(SyncTypeRequest req, ICurrentUser currentUser);

    Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync();
    Task<ApiResult> SaveExportTypeAsync(ExportTypeRequest req, ICurrentUser currentUser);
}

public class ConfigService : IConfigService
{
    private readonly ICnfRepository _cnfRepo;

    public ConfigService(ICnfRepository cnfRepo)
    {
        _cnfRepo = cnfRepo;
    }

    public async Task<IEnumerable<ConfigItemDto>> GetSystemConfigsAsync()
        => await _cnfRepo.GetConfigsAsync();

    public async Task<ApiResult> SaveConfigAsync(SaveConfigRequest req, ICurrentUser currentUser)
    {
        await _cnfRepo.UpsertConfigAsync(req.Key, req.Value, currentUser.Id, req.GroupName, req.Description);
        return ApiResult.Ok("Đã lưu cấu hình");
    }

    public async Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync()
        => await _cnfRepo.GetContentTypesAsync();

    public async Task<ApiResult> SaveContentTypeAsync(ContentTypeRequest req, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertContentTypeAsync(req, currentUser.Id);
        else
            await _cnfRepo.UpdateContentTypeAsync(req, currentUser.Id);
        return ApiResult.Ok("Đã lưu loại nội dung");
    }

    public async Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync()
        => await _cnfRepo.GetRecordTypesAsync();

    public async Task<ApiResult> SaveRecordTypeAsync(RecordTypeRequest req, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertRecordTypeAsync(req, currentUser.Id);
        else
            await _cnfRepo.UpdateRecordTypeAsync(req, currentUser.Id);
        return ApiResult.Ok("Đã lưu loại hồ sơ");
    }

    public async Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync()
        => await _cnfRepo.GetSyncTypesAsync();

    public async Task<ApiResult> SaveSyncTypeAsync(SyncTypeRequest req, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertSyncTypeAsync(req, currentUser.Id);
        else
            await _cnfRepo.UpdateSyncTypeAsync(req, currentUser.Id);
        return ApiResult.Ok("Đã lưu kiểu đồng bộ");
    }

    public async Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync()
        => await _cnfRepo.GetExportTypesAsync();

    public async Task<ApiResult> SaveExportTypeAsync(ExportTypeRequest req, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertExportTypeAsync(req, currentUser.Id);
        else
            await _cnfRepo.UpdateExportTypeAsync(req, currentUser.Id);
        return ApiResult.Ok("Đã lưu kiểu xuất dữ liệu");
    }
}
