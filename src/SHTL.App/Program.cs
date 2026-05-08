using System.IO;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using SHTL;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Infrastructure.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = null);

// IIS: ghi key ring ra đĩa (ContentRoot/dp-keys) để antiforgery + cookie ổn định; cấp quyền ghi cho app pool.
var dpKeysDir = Path.Combine(builder.Environment.ContentRootPath, "dp-keys");
Directory.CreateDirectory(dpKeysDir);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dpKeysDir))
    .SetApplicationName("SHTL");

builder.Services.AddControllersWithViews()
    .AddApplicationPart(typeof(WebSharedMarker).Assembly)
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

builder.Services.AddAntiforgery(o => o.HeaderName = "RequestVerificationToken");

builder.Services.Configure<ShellOptions>(
    builder.Configuration.GetSection(ShellOptions.SectionName));

builder.Services.AddShtlMonolith(builder.Configuration);

builder.Services.AddSession(opts =>
{
    opts.IdleTimeout = TimeSpan.FromHours(2);
    opts.Cookie.HttpOnly = true;
    opts.Cookie.IsEssential = true;
});

builder.Services.AddMemoryCache();

var app = builder.Build();

var shellForPath = builder.Configuration.GetSection(ShellOptions.SectionName).Get<ShellOptions>();
var pathBase = shellForPath?.PublicPathBase?.Trim()
               ?? Environment.GetEnvironmentVariable("ASPNETCORE_PATHBASE")?.Trim();
if (!string.IsNullOrEmpty(pathBase) && pathBase != "/")
{
    if (!pathBase.StartsWith('/'))
        pathBase = "/" + pathBase;
    pathBase = pathBase.TrimEnd('/');
    app.UsePathBase(pathBase);
}

if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
{
    app.UseExceptionHandler("/dashboard/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
var staticCt = new FileExtensionContentTypeProvider();
staticCt.Mappings[".properties"] = "text/plain; charset=utf-8";
staticCt.Mappings[".bcmap"] = "application/octet-stream";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = staticCt });
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();
app.UseShtlAccessLogging();

// "/" không khớp route mặc định vì mọi controller nằm trong area — chuyển hướng vào đăng nhập.
app.MapGet("/", (HttpContext http, IOptions<ShellOptions> shellOpt) =>
{
    var loginPath = shellOpt.Value.ExternalLoginUrl?.Trim();
    if (string.IsNullOrEmpty(loginPath))
        loginPath = "/account/Account/Login";
    if (!loginPath.StartsWith('/'))
        loginPath = "/" + loginPath;
    var pathBase = http.Request.PathBase.Value ?? "";
    return Results.Redirect(pathBase + loginPath);
});

app.MapAreaControllerRoute("area_account", "account", "account/{controller=Home}/{action=Index}/{id?}");
app.MapAreaControllerRoute("area_admin", "admin", "admin/{controller=Home}/{action=Index}/{id?}");
app.MapAreaControllerRoute("area_dashboard", "dashboard", "dashboard/{controller=Home}/{action=Index}/{id?}");
app.MapAreaControllerRoute("area_sohoa", "sohoa", "sohoa/{controller=Home}/{action=Index}/{id?}");
app.MapAreaControllerRoute("area_uploader", "uploader", "uploader/{controller=Home}/{action=Index}/{id?}");

app.MapControllers();

app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

app.Run();
