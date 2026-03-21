namespace Web.Dashboard.Models;

/// <summary>
/// Đăng nhập / đăng xuất do Web.Account phục vụ (cùng host IIS: path /account/... hoặc URL đầy đủ khi dev).
/// </summary>
public class DashboardAuthOptions
{
    public const string SectionName = "Authentication";

    /// <summary>URL trang đăng nhập (vd: /account/Account/Login hoặc http://localhost:5119/Account/Login).</summary>
    public string ExternalLoginUrl { get; set; } = "/account/Account/Login";

    /// <summary>URL đăng xuất GET (vd: /account/Account/Logout).</summary>
    public string ExternalLogoutUrl { get; set; } = "/account/Account/Logout";
}
