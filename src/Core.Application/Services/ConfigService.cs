using Core.Domain.Contracts;
using Infrastructure.Data.Repositories.Cnf;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IConfigService
{
    Task<IEnumerable<ConfigItemDto>> GetSystemConfigsAsync(int channelId);
    Task<ApiResult> SaveConfigAsync(SaveConfigRequest req, int channelId, ICurrentUser currentUser);

    Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync(int channelId);
    Task<ApiResult> SaveContentTypeAsync(ContentTypeRequest req, int channelId, ICurrentUser currentUser);

    Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync(int channelId);
    Task<ApiResult> SaveRecordTypeAsync(RecordTypeRequest req, int channelId, ICurrentUser currentUser);

    Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync(int channelId);
    Task<ApiResult> SaveSyncTypeAsync(SyncTypeRequest req, int channelId, ICurrentUser currentUser);

    Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync(int channelId);
    Task<ApiResult> SaveExportTypeAsync(ExportTypeRequest req, int channelId, ICurrentUser currentUser);
}

public class ConfigService : IConfigService
{
    private readonly ICnfRepository _cnfRepo;

    public ConfigService(ICnfRepository cnfRepo)
    {
        _cnfRepo = cnfRepo;
    }

    public async Task<IEnumerable<ConfigItemDto>> GetSystemConfigsAsync(int channelId)
        => await _cnfRepo.GetConfigsAsync(channelId);

    public async Task<ApiResult> SaveConfigAsync(SaveConfigRequest req, int channelId, ICurrentUser currentUser)
    {
        await _cnfRepo.UpsertConfigAsync(req.Key, req.Value, channelId, currentUser.Id);
        return ApiResult.Ok("Đã lưu cấu hình");
    }

    public async Task<IEnumerable<ContentTypeDto>> GetContentTypesAsync(int channelId)
        => await _cnfRepo.GetContentTypesAsync(channelId);

    public async Task<ApiResult> SaveContentTypeAsync(ContentTypeRequest req, int channelId, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertContentTypeAsync(req, channelId, currentUser.Id);
        else
            await _cnfRepo.UpdateContentTypeAsync(req, channelId, currentUser.Id);
        return ApiResult.Ok("Đã lưu loại nội dung");
    }

    public async Task<IEnumerable<RecordTypeDto>> GetRecordTypesAsync(int channelId)
        => await _cnfRepo.GetRecordTypesAsync(channelId);

    public async Task<ApiResult> SaveRecordTypeAsync(RecordTypeRequest req, int channelId, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertRecordTypeAsync(req, channelId, currentUser.Id);
        else
            await _cnfRepo.UpdateRecordTypeAsync(req, channelId, currentUser.Id);
        return ApiResult.Ok("Đã lưu loại hồ sơ");
    }

    public async Task<IEnumerable<SyncTypeDto>> GetSyncTypesAsync(int channelId)
        => await _cnfRepo.GetSyncTypesAsync(channelId);

    public async Task<ApiResult> SaveSyncTypeAsync(SyncTypeRequest req, int channelId, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertSyncTypeAsync(req, channelId, currentUser.Id);
        else
            await _cnfRepo.UpdateSyncTypeAsync(req, channelId, currentUser.Id);
        return ApiResult.Ok("Đã lưu kiểu đồng bộ");
    }

    public async Task<IEnumerable<ExportTypeDto>> GetExportTypesAsync(int channelId)
        => await _cnfRepo.GetExportTypesAsync(channelId);

    public async Task<ApiResult> SaveExportTypeAsync(ExportTypeRequest req, int channelId, ICurrentUser currentUser)
    {
        if (req.Id == 0)
            await _cnfRepo.InsertExportTypeAsync(req, channelId, currentUser.Id);
        else
            await _cnfRepo.UpdateExportTypeAsync(req, channelId, currentUser.Id);
        return ApiResult.Ok("Đã lưu kiểu xuất dữ liệu");
    }
}
