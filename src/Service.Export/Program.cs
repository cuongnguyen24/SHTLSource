using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SHTL.Exporting;
using SHTL.Service.Export;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = builder.Configuration["WindowsService:ServiceName"] ?? "SHTL Export";
});

builder.Services.Configure<ExportOptions>(builder.Configuration.GetSection(ExportOptions.SectionName));
builder.Services.Configure<ExportWorkerServiceOptions>(
    builder.Configuration.GetSection(ExportWorkerServiceOptions.SectionName));

builder.Services.AddSingleton<ExportQueueRepository>();
builder.Services.AddHostedService<ExportWorkerHostedService>();

var host = builder.Build();
host.Run();
