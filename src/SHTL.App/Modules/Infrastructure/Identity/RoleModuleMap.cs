using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Infrastructure.Identity;

/// <summary>
/// Ánh xạ "mã vai trò" (acc_roles.code) → tập <see cref="ModuleCode"/> mà vai trò đó được phép truy cập.
/// Cho phép kiểm tra phân quyền theo vai trò mà không cần ghi vào bảng acc_role_permissions.
/// </summary>
public static class RoleModuleMap
{
    private static readonly Dictionary<string, HashSet<ModuleCode>> Map = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CHECK_SCAN_1"] = new() { ModuleCode.CheckScanFirst },
        ["CHECK_SCAN_2"] = new() { ModuleCode.CheckScanSecond },

        ["EXTRACT"] = new()
        {
            ModuleCode.ExtractDigit,
            ModuleCode.ExtractAlphabet,
            ModuleCode.ExtractCharacter,
            ModuleCode.ExtractTick,
            ModuleCode.ExtractForm,
        },

        ["CHECK_EXTRACT_1"] = new() { ModuleCode.CheckFirst },
        ["CHECK_EXTRACT_2"] = new() { ModuleCode.CheckSecond },

        ["STATS_DIGITIZATION"] = new()
        {
            ModuleCode.Report,
            ModuleCode.ReportProductivity,
            ModuleCode.ReportQuality,
            ModuleCode.ReportLog,
        },
    };

    /// <summary>Kiểm tra một mã vai trò có quyền truy cập một module hay không.</summary>
    public static bool RoleHasModule(string roleCode, ModuleCode module)
    {
        if (string.IsNullOrWhiteSpace(roleCode)) return false;
        return Map.TryGetValue(roleCode.Trim(), out var modules) && modules.Contains(module);
    }
}
