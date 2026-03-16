using Core.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Application;

public static class AppServiceExtensions
{
    public static IServiceCollection AddCoreApplication(this IServiceCollection services)
    {
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IDocumentWorkflowService, DocumentWorkflowService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IAuthAppService, AuthAppService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IDeptService, DeptService>();
        services.AddScoped<IConfigService, ConfigService>();
        services.AddScoped<ILogService, LogService>();
        return services;
    }
}
