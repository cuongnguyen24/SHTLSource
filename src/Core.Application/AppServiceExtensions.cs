using Core.Application.Services;
using Core.Application.Services.Axe;
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
        services.AddScoped<IDocCatalogService, DocCatalogService>();
        services.AddScoped<IAxeDocTypeAdminService, AxeDocTypeAdminService>();
        services.AddScoped<IAxeSyncTypeAdminService, AxeSyncTypeAdminService>();
        services.AddScoped<IDocumentSyncUploadService, DocumentSyncUploadService>();
        services.AddScoped<IDocumentFormViewModelBuilder, DocumentFormViewModelBuilder>();
        return services;
    }
}
