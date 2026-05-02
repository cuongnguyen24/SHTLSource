using SHTL.Modules.Core.Domain.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace SHTL.Modules.Infrastructure.Identity;

public static class IdentityServiceExtensions
{
    public static IServiceCollection AddInfrastructureIdentity(this IServiceCollection services)
    {
        // CRITICAL SECURITY FIX: Use BCryptPasswordHasher instead of PlaintextPasswordHasher
        // BCrypt provides secure password hashing with configurable work factor
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICurrentUser>(sp =>
        {
            var httpCtx = sp.GetRequiredService<IHttpContextAccessor>();
            return new CurrentUser(httpCtx.HttpContext?.User
                ?? new System.Security.Claims.ClaimsPrincipal());
        });
        services.AddHttpContextAccessor();

        return services;
    }
}
