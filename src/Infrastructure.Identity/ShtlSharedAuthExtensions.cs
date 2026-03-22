using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Identity;

/// <summary>
/// Cho phép nhiều app ASP.NET Core trên cùng host (vd IIS: /account + /) dùng chung cookie đăng nhập.
/// Cần cùng: tên cookie, Path=/, và key DataProtection (PersistKeys + ApplicationName).
/// </summary>
public static class ShtlSharedAuthExtensions
{
    public const string DefaultCookieName = ".Shtl.Auth";
    public const string SharedApplicationName = "SHTL";

    /// <summary>
    /// Lưu key mã hóa cookie ra thư mục dùng chung để mọi app giải mã được cookie do app khác phát hành.
    /// </summary>
    public static IServiceCollection AddShtlSharedDataProtection(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var keyPath = configuration["Authentication:DataProtectionKeysPath"];
        if (string.IsNullOrWhiteSpace(keyPath))
        {
            keyPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SHTL",
                "DataProtection-Keys");
        }

        Directory.CreateDirectory(keyPath);
        services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keyPath))
            .SetApplicationName(SharedApplicationName);
        return services;
    }

    /// <summary>
    /// Đăng ký cookie auth với tùy chọn dùng chung; gọi <paramref name="configure"/> để set LoginPath, Events, ...
    /// </summary>
    public static IServiceCollection AddShtlAuthenticationWithSharedCookie(
        this IServiceCollection services,
        IConfiguration configuration,
        Action<CookieAuthenticationOptions>? configure = null)
    {
        services.AddShtlSharedDataProtection(configuration);

        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(opts =>
            {
                opts.Cookie.Name = configuration["Authentication:CookieName"]?.Trim() is { Length: > 0 } n
                    ? n
                    : DefaultCookieName;
                opts.Cookie.Path = "/";
                opts.Cookie.HttpOnly = true;
                opts.Cookie.SameSite = SameSiteMode.Lax;
                opts.SlidingExpiration = true;
                opts.ExpireTimeSpan = TimeSpan.FromHours(8);
                configure?.Invoke(opts);
            });

        return services;
    }
}
