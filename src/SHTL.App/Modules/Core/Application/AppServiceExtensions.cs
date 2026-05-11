using SHTL.Modules.Core.Application.Options;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Application.Services.Axe;

namespace SHTL.Modules.Core.Application;

public static class AppServiceExtensions
{
    public static IServiceCollection AddCoreApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SearchablePdfOptions>(configuration.GetSection(SearchablePdfOptions.SectionName));
        services.AddScoped<ISearchablePdfPythonRunner, SearchablePdfPythonRunner>();
        services.AddScoped<ISearchablePdfProcessor, SearchablePdfProcessor>();
        var pdfOpts = configuration.GetSection(SearchablePdfOptions.SectionName).Get<SearchablePdfOptions>() ?? new SearchablePdfOptions();
        if (pdfOpts.RunWorkerInWebProcess)
            services.AddHostedService<SearchablePdfHostedService>();

        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IDocumentWorkflowService, DocumentWorkflowService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IAuthAppService, AuthAppService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IDeptService, DeptService>();
        services.AddScoped<IConfigService, ConfigService>();
        services.AddScoped<ILogService, LogService>();
        services.AddScoped<IFolderProgressReportService, FolderProgressReportService>();
        services.AddScoped<IFolderDocumentsPurgeService, FolderDocumentsPurgeService>();
        services.AddScoped<IDocCatalogService, DocCatalogService>();
        services.AddScoped<IAxeDocTypeAdminService, AxeDocTypeAdminService>();
        services.AddScoped<IAxeSyncTypeAdminService, AxeSyncTypeAdminService>();
        services.AddScoped<IDocumentSyncUploadService, DocumentSyncUploadService>();
        services.AddScoped<IDocumentFormViewModelBuilder, DocumentFormViewModelBuilder>();
        return services;
    }
}
