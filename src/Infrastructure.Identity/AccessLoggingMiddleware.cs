using System.Diagnostics;
using System.Security.Claims;
using Infrastructure.Data.Repositories.Log;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Identity;

public sealed class AccessLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AccessLoggingMiddleware> _logger;

    public AccessLoggingMiddleware(RequestDelegate next, ILogger<AccessLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IServiceScopeFactory scopeFactory, IOptions<AccessLoggingOptions> options)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var opts = options.Value;
            if (opts.Enabled && ShouldLog(context, opts))
            {
                try
                {
                    var path = $"{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}";
                    if (path.Length > 8000)
                        path = path[..8000];

                    var user = context.User;
                    var userId = int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : 0;
                    var userName = user.FindFirstValue(ClaimTypes.Name);
                    var channelId = int.TryParse(user.FindFirstValue(ClaimKeys.ChannelId), out var cid) ? cid : opts.DefaultChannelId;
                    if (channelId <= 0)
                        channelId = opts.DefaultChannelId;

                    var ip = context.Connection.RemoteIpAddress?.ToString();
                    var ua = context.Request.Headers.UserAgent.ToString();
                    if (ua.Length > 2000)
                        ua = ua[..2000];

                    using var scope = scopeFactory.CreateScope();
                    var repo = scope.ServiceProvider.GetRequiredService<ILogRepository>();
                    await repo.WriteAccessLogAsync(
                        channelId,
                        userId,
                        userName,
                        path,
                        context.Request.Method,
                        context.Response.StatusCode,
                        sw.ElapsedMilliseconds,
                        ip,
                        string.IsNullOrEmpty(ua) ? null : ua);
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Không ghi được access log");
                }
            }
        }
    }

    private static bool ShouldLog(HttpContext context, AccessLoggingOptions opts)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
            return false;

        var p = (context.Request.PathBase + context.Request.Path).Value ?? "";
        if (string.IsNullOrEmpty(p))
            p = "/";

        foreach (var prefix in opts.ExcludePathPrefixes)
        {
            if (string.IsNullOrEmpty(prefix))
                continue;
            var normalized = prefix.StartsWith('/') ? prefix : "/" + prefix;
            if (p.StartsWith(normalized, StringComparison.OrdinalIgnoreCase))
                return false;
        }

        return true;
    }
}

public static class AccessLoggingExtensions
{
    public static IServiceCollection AddShtlAccessLogging(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AccessLoggingOptions>(configuration.GetSection(AccessLoggingOptions.SectionName));
        return services;
    }

    public static IApplicationBuilder UseShtlAccessLogging(this IApplicationBuilder app)
        => app.UseMiddleware<AccessLoggingMiddleware>();
}
