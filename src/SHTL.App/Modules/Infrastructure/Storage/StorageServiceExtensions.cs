using SHTL.Modules.Core.Domain.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SHTL.Modules.Infrastructure.Storage;

public static class StorageServiceExtensions
{
    public static IServiceCollection AddInfrastructureStorage(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StorageOptions>(configuration.GetSection("Storage"));
        services.AddScoped<IStorageService, LocalFileStorageService>();
        return services;
    }
}
