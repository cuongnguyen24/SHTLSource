namespace Infrastructure.Identity;

/// <summary>Cấu hình ghi nhật ký truy cập HTTP vào core_log.access_logs.</summary>
public class AccessLoggingOptions
{
    public const string SectionName = "AccessLogging";

    public bool Enabled { get; set; } = true;

    /// <summary>Kênh mặc định khi request chưa đăng nhập (claim channel_id).</summary>
    public int DefaultChannelId { get; set; } = 1;

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
