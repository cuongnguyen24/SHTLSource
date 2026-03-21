namespace Web.Dashboard.Models;

/// <summary>
/// URL tới từng web module (IIS Application con hoặc subdomain).
/// Tham khảo bố cục AXE-Dash: ô tổng quan dẫn tới quản trị, nghiệp vụ, …
/// </summary>
public class DashboardModuleLinks
{
    public const string SectionName = "Dashboard";

    /// <summary>Tiêu đề trang / navbar.</summary>
    public string ProductTitle { get; set; } = "SHTL - Tổng quan";

    public string AdminUrl { get; set; } = "/admin";
    public string SoHoaUrl { get; set; } = "/sohoa";
    public string UploaderUrl { get; set; } = "/uploader";
    public string AccountUrl { get; set; } = "/account";

    /// <summary>Đường dẫn hồ sơ trong Web.Account (sau AccountUrl).</summary>
    public string ProfilePath { get; set; } = "/Profile";

    public string ProfileUrl => Join(AccountUrl, ProfilePath);

    public static string Join(string baseUrl, string path)
    {
        baseUrl = (baseUrl ?? "").TrimEnd('/');
        path = path ?? "";
        if (!path.StartsWith('/')) path = "/" + path;
        return string.IsNullOrEmpty(baseUrl) ? path : baseUrl + path;
    }
}
