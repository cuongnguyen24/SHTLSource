using Core.Application;
using Infrastructure.Data;
using Infrastructure.Identity;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using System.IO;
using Web.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"), optional: false, reloadOnChange: true);

builder.Services.AddControllersWithViews()
    .AddApplicationPart(typeof(WebSharedMarker).Assembly);

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

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseShtlAccessLogging();

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
