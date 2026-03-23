using Core.Application;
using Infrastructure.Data;
using Infrastructure.Identity;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using System.IO;
using System.Text.Json;
using Web.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 524_288_000); // 500 MB — upload đồng bộ batch

builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"), optional: false, reloadOnChange: true);

builder.Services.AddControllersWithViews()
    .AddApplicationPart(typeof(WebSharedMarker).Assembly)
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

builder.Services.Configure<ShellOptions>(
    builder.Configuration.GetSection(ShellOptions.SectionName));

builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddInfrastructureIdentity();
builder.Services.AddShtlAccessLogging(builder.Configuration);
builder.Services.AddInfrastructureStorage(builder.Configuration);
builder.Services.AddCoreApplication();

builder.Services.AddShtlAuthenticationWithSharedCookie(builder.Configuration, opts =>
{
    opts.LoginPath = "/account/Account/Login";
    opts.LogoutPath = "/account/Account/Logout";
    opts.AccessDeniedPath = "/account/Account/Login";
    opts.Events.OnRedirectToLogin = ctx => RedirectToExternalLogin(ctx);
    opts.Events.OnRedirectToAccessDenied = ctx => RedirectToExternalLogin(ctx);
});

builder.Services.AddAuthorization();

builder.Services.AddSession(opts =>
{
    opts.IdleTimeout = TimeSpan.FromHours(2);
    opts.Cookie.HttpOnly = true;
    opts.Cookie.IsEssential = true;
});

builder.Services.AddMemoryCache();

var app = builder.Build();

// IIS virtual app: nếu request Path vẫn là /sohoa/scan/... thì cần UsePathBase (trừ khi ANCM đã tách PathBase).
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

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/home/error");
    app.UseHsts();
}

app.UseHttpsRedirection();
// PDF.js l10n + cmaps: mặc định không map .properties / .bcmap → 404
var staticCt = new FileExtensionContentTypeProvider();
staticCt.Mappings[".properties"] = "text/plain; charset=utf-8";
staticCt.Mappings[".bcmap"] = "application/octet-stream";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = staticCt });
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseShtlAccessLogging();
app.UseSession();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

static Task RedirectToExternalLogin(RedirectContext<CookieAuthenticationOptions> ctx)
{
    var loginUrl = ctx.HttpContext.RequestServices
        .GetRequiredService<IOptions<ShellOptions>>().Value.ExternalLoginUrl;
    if (string.IsNullOrWhiteSpace(loginUrl))
        loginUrl = "/account/Account/Login";

    var req = ctx.HttpContext.Request;
    string returnUrl;
    if (loginUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
        || loginUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
    {
        returnUrl = $"{req.Scheme}://{req.Host}{req.PathBase}{req.Path}{req.QueryString}";
    }
    else
    {
        returnUrl = $"{req.PathBase}{req.Path}{req.QueryString}";
    }

    var sep = loginUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
    var target = $"{loginUrl.TrimEnd('/')}{sep}returnUrl={Uri.EscapeDataString(returnUrl)}";
    ctx.Response.Redirect(target);
    return Task.CompletedTask;
}
