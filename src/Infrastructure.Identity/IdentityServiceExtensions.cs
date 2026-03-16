using Core.Domain.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Identity;

public static class IdentityServiceExtensions
{
    public static IServiceCollection AddInfrastructureIdentity(this IServiceCollection services)
    {
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
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
