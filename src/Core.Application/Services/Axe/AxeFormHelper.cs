using Microsoft.AspNetCore.Http;

namespace Core.Application.Services.Axe;

public static class AxeFormHelper
{
    public static string? GetString(IFormCollection? form, string key)
        => form != null && form.TryGetValue(key, out var v) ? v.ToString() : null;

    public static int GetInt(IFormCollection? form, string key)
    {
        var s = GetString(form, key);
        return int.TryParse(s, out var n) ? n : 0;
    }

    public static bool GetBool(IFormCollection? form, string key)
    {
        if (form == null || !form.ContainsKey(key)) return false;
        var v = form[key].ToString();
        return v == "1" || v.Equals("true", StringComparison.OrdinalIgnoreCase) || v == "on";
    }
}
