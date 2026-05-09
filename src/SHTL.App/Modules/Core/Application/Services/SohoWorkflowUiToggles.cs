namespace SHTL.Modules.Core.Application.Services;

/// <summary>
/// Đọc cờ hiển thị menu/lối tắt SoHoa từ <c>cnf_configs</c> (đồng bộ semantics với Extract/Workflow).
/// </summary>
public static class SohoWorkflowUiToggles
{
    /// <summary>True = hiện chức năng; key thiếu hoặc rỗng = bật (mặc định).</summary>
    public static bool IsFeatureEnabled(IReadOnlyDictionary<string, string?> configs, string key)
    {
        if (!configs.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
            return true;

        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "1" or "true" or "on" or "yes";
    }
}
