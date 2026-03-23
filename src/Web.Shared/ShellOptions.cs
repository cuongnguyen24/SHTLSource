namespace Web.Shared;

/// <summary>
/// Giao diện vỏ (header) dùng chung + URL module. Cấu hình mục "Shell" trong appsettings.
/// </summary>
public class ShellOptions
{
    public const string SectionName = "Shell";

    public string ProductTitle { get; set; } = "SHTL - Tổng quan";

    public string BrandShort { get; set; } = "SHTL";

    /// <summary>
    /// URL trang chủ portal (Dashboard), dùng cho logo SHTL.
    /// Trên IIS: đặt <c>/home.html</c> khi ứng dụng Dashboard là app gốc của site (xử lý <c>/</c>).
    /// Khi chạy từng project Kestrel cổng khác nhau: dùng URL đầy đủ, ví dụ <c>http://localhost:5075/home.html</c>.
    /// </summary>
    public string HomeUrl { get; set; } = "/home.html";

    public string? Hotline { get; set; }

    public string AdminUrl { get; set; } = "/admin";
    public string SoHoaUrl { get; set; } = "/sohoa";

    /// <summary>
    /// Khi ứng dụng được publish dưới tiền tố URL (vd. IIS virtual app <c>/sohoa</c>) mà host không tách PathBase,
    /// đặt giá trị này (vd. <c>/sohoa</c>) để route <c>/scan/...</c> khớp. Để trống nếu host đã set PathBase (ANCM thường đã xử lý).
    /// </summary>
    public string? PublicPathBase { get; set; }

    public string UploaderUrl { get; set; } = "/uploader";
    public string AccountUrl { get; set; } = "/account";

    public string ProfilePath { get; set; } = "/Profile";

    public string ProfileUrl => Join(AccountUrl, ProfilePath);

    /// <summary>Đăng nhập tập trung (Web.Account).</summary>
    public string ExternalLoginUrl { get; set; } = "/account/Account/Login";

    public string ExternalLogoutUrl { get; set; } = "/account/Account/Logout";

    public static string Join(string baseUrl, string path)
    {
        baseUrl = (baseUrl ?? "").TrimEnd('/');
        path = path ?? "";
        if (!path.StartsWith('/')) path = "/" + path;
        return string.IsNullOrEmpty(baseUrl) ? path : baseUrl + path;
    }
}
