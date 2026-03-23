using Infrastructure.Data.Repositories.Acc;
using Infrastructure.Data.Repositories.Cnf;
using Infrastructure.Data.Repositories.Log;
using Infrastructure.Data.Repositories.Stg;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Data;

public static class DataServiceExtensions
{
    public static IServiceCollection AddInfrastructureData(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var opts = new DbConnectionOptions();
        configuration.GetSection("ConnectionStrings").Bind(opts);
        services.AddSingleton(opts);
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

        // Acc
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IDeptRepository, DeptRepository>();

        // Cnf
        services.AddScoped<ICnfRepository, CnfRepository>();

        // Stg
        services.AddScoped<IDocumentRepository, DocumentRepository>();
        services.AddScoped<IDocCatalogRepository, DocCatalogRepository>();
        services.AddScoped<IAxeDocTypeRepository, AxeDocTypeRepository>();
        services.AddScoped<IAxeSyncTypeRepository, AxeSyncTypeRepository>();
        services.AddScoped<IFormCellRepository, FormCellRepository>();
        services.AddScoped<IOcrJobRepository, OcrJobRepository>();
        services.AddScoped<IExportJobRepository, ExportJobRepository>();

        // Log
        services.AddScoped<IActionLogRepository, ActionLogRepository>();
        services.AddScoped<IErrorLogRepository, ErrorLogRepository>();
        services.AddScoped<ILogRepository, LogRepository>();

        return services;
    }
}
