using Dapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Log;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;

namespace SHTL.Modules.Infrastructure.Data;

public static class DataServiceExtensions
{
    public static IServiceCollection AddInfrastructureData(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        services.AddDbContext<AppDbContext>(options =>
        {
            var cs = configuration.GetConnectionString("DefaultConnection")
                     ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
            options.UseSqlServer(cs);
            options.UseSnakeCaseNamingConvention();
        });

        services.AddScoped<IUserRepository, UserRepository>();

        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IDeptRepository, DeptRepository>();

        services.AddScoped<ICnfRepository, CnfRepository>();

        services.AddScoped<IDocumentRepository, DocumentRepository>();
        services.AddScoped<IDocCatalogRepository, DocCatalogRepository>();
        services.AddScoped<IAxeDocTypeRepository, AxeDocTypeRepository>();
        services.AddScoped<IAxeSyncTypeRepository, AxeSyncTypeRepository>();
        services.AddScoped<IFormCellRepository, FormCellRepository>();
        services.AddScoped<IOcrJobRepository, OcrJobRepository>();
        services.AddScoped<IExportJobRepository, ExportJobRepository>();
        services.AddScoped<IExportTypeRepository, ExportTypeRepository>();
        services.AddScoped<IRepository<SHTL.Modules.Core.Domain.Entities.Stg.ExportType>>(sp => sp.GetRequiredService<IExportTypeRepository>());

        services.AddScoped<IActionLogRepository, ActionLogRepository>();
        services.AddScoped<IErrorLogRepository, ErrorLogRepository>();
        services.AddScoped<ILogRepository, LogRepository>();

        return services;
    }
}
