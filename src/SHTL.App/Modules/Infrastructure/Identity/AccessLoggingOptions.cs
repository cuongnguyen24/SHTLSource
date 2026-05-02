namespace SHTL.Modules.Infrastructure.Identity;

/// <summary>Cấu hình ghi nhật ký truy cập HTTP vào dbo.log_access_logs.</summary>
public class AccessLoggingOptions
{
    public const string SectionName = "AccessLogging";

    public bool Enabled { get; set; } = true;

    /// <summary>Bỏ qua nếu đường dẫn (PathBase + Path) bắt đầu bằng một trong các chuỗi này.</summary>
    public string[] ExcludePathPrefixes { get; set; } =
    {
        "/_content",
        "/css/",
        "/js/",
        "/lib/",
        "/files",
        "/favicon",
        "/.well-known",
        "/health"
    };
}
