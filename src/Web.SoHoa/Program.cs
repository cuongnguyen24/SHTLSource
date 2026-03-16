using Core.Application;
using Infrastructure.Data;
using Infrastructure.Identity;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine("..", "config", "connectionstrings.json"), optional: false, reloadOnChange: true);

// Add MVC
builder.Services.AddControllersWithViews();

// Infrastructure
builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddInfrastructureIdentity();
builder.Services.AddInfrastructureStorage(builder.Configuration);

// Application
builder.Services.AddCoreApplication();

// Cookie Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opts =>
    {
        opts.LoginPath = "/account/login";
        opts.LogoutPath = "/account/logout";
        opts.AccessDeniedPath = "/account/access-denied";
        opts.SlidingExpiration = true;
        opts.ExpireTimeSpan = TimeSpan.FromHours(8);
    });

builder.Services.AddAuthorization();

// Session
builder.Services.AddSession(opts =>
{
    opts.IdleTimeout = TimeSpan.FromHours(2);
    opts.Cookie.HttpOnly = true;
    opts.Cookie.IsEssential = true;
});

// Memory Cache
builder.Services.AddMemoryCache();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/home/error");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseSession();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
