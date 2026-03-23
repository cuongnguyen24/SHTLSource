using Core.Application;
using Infrastructure.Data;
using Infrastructure.Identity;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.IO;
using Web.Dashboard.Models;
using Web.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"), optional: false, reloadOnChange: true);

builder.Services.AddControllersWithViews()
    .AddApplicationPart(typeof(WebSharedMarker).Assembly);

builder.Services.Configure<ShellOptions>(
    builder.Configuration.GetSection(ShellOptions.SectionName));
builder.Services.Configure<ErrorHandlingOptions>(
    builder.Configuration.GetSection(ErrorHandlingOptions.SectionName));

builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddInfrastructureIdentity();
builder.Services.AddShtlAccessLogging(builder.Configuration);
builder.Services.AddInfrastructureStorage(builder.Configuration);
builder.Services.AddCoreApplication();

builder.Services.AddShtlAuthenticationWithSharedCookie(builder.Configuration, opts =>
{
    opts.LoginPath = "/Account/Login";
    opts.LogoutPath = "/Account/Logout";
    opts.AccessDeniedPath = "/Account/Login";
    opts.Events.OnRedirectToLogin = ctx => RedirectToAccountLogin(ctx);
    opts.Events.OnRedirectToAccessDenied = ctx => RedirectToAccountLogin(ctx);
});
builder.Services.AddAuthorization();

var app = builder.Build();

var errorOpts = app.Configuration.GetSection(ErrorHandlingOptions.SectionName).Get<ErrorHandlingOptions>()
    ?? new ErrorHandlingOptions();

if (app.Environment.IsDevelopment() && !errorOpts.UseCustomErrorPages)
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

if (errorOpts.UseCustomErrorPages)
{
    app.UseStatusCodePagesWithReExecute("/Home/StatusCode", "?code={0}");
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseShtlAccessLogging();

app.MapGet("/home.html", (HttpContext ctx) =>
{
    var basePath = ctx.Request.PathBase.Value?.TrimEnd('/') ?? "";
    var target = string.IsNullOrEmpty(basePath) ? "/" : basePath + "/";
    ctx.Response.Redirect(target);
    return Task.CompletedTask;
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

static Task RedirectToAccountLogin(RedirectContext<CookieAuthenticationOptions> ctx)
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
