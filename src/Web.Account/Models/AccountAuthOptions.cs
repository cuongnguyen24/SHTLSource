namespace Web.Account.Models;

/// <summary>
/// Cho phép redirect sau đăng nhập về app khác (cùng host hoặc URL đầy đủ trong dev).
/// </summary>
public class AccountAuthOptions
{
    public const string SectionName = "Authentication";

    /// <summary>Tiền tố URL được phép (vd: http://localhost:2477, https://site.com).</summary>
    public string[] AllowedReturnUrlPrefixes { get; set; } = Array.Empty<string>();

    public string DefaultLandingUrl { get; set; } = "/";
}
