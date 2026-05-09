using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;

namespace SHTL.Modules.Core.Application.Services;

/// <summary>Chọn <see cref="WorkflowStep"/> ngay sau upload theo cấu hình cnf (vd. <c>IsCheckFirstScan</c>).</summary>
public static class WorkflowUploadInitialStep
{
    public static async Task<WorkflowStep> ResolveAsync(ICnfRepository cnfRepo, CancellationToken cancellationToken = default)
    {
        if (!await IsCheckFirstScanEnabledAsync(cnfRepo, cancellationToken))
            return WorkflowStep.Extract;
        // Vào thẳng hàng đợi kiểm tra scan lần 1 (không dừng ở bước Scan rồi phải thao tác thêm).
        return WorkflowStep.CheckScan1;
    }

    /// <summary>Đang bật kiểm tra scan lần 1 trong cấu hình kênh (mặc định bật nếu key trống).</summary>
    public static async Task<bool> IsCheckFirstScanEnabledAsync(ICnfRepository cnfRepo, CancellationToken cancellationToken = default)
    {
        var configs = await cnfRepo.GetConfigsAsync();
        cancellationToken.ThrowIfCancellationRequested();
        var map = configs.ToDictionary(x => x.Key ?? string.Empty, x => x.Value, StringComparer.OrdinalIgnoreCase);
        return ReadToggle(map, "IsCheckFirstScan");
    }

    private static bool ReadToggle(IReadOnlyDictionary<string, string?> configs, string key)
    {
        if (!configs.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
            return true;
        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "1" or "true" or "on" or "yes";
    }
}
