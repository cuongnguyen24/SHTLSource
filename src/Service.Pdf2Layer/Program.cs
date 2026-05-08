using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SHTL.Service.Pdf2Layer;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = builder.Configuration["WindowsService:ServiceName"] ?? "SHTL Pdf2Layer";
});

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.Configure<SearchablePdfWorkerOptions>(builder.Configuration.GetSection(SearchablePdfWorkerOptions.SectionName));

builder.Services.AddSingleton<Pdf2LayerJobRepository>();
builder.Services.AddSingleton<WorkerFileStorage>();
builder.Services.AddSingleton<Pdf2PythonRunner>();
builder.Services.AddSingleton<Pdf2Processor>();
builder.Services.AddHostedService<Pdf2WorkerHostedService>();

var host = builder.Build();
host.Run();
