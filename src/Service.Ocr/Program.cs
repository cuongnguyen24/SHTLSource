using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SHTL.Service.Ocr;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = Host.CreateApplicationBuilder(args);

var pdfOptions = builder.Configuration.GetSection(OcrSearchablePdfWorkerOptions.SectionName).Get<OcrSearchablePdfWorkerOptions>()
                 ?? new OcrSearchablePdfWorkerOptions();
AppDataFileLog.Configure(pdfOptions.LogRootPath);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = builder.Configuration["WindowsService:ServiceName"] ?? "SHTL OcrService";
});

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.Configure<OcrSearchablePdfWorkerOptions>(builder.Configuration.GetSection(OcrSearchablePdfWorkerOptions.SectionName));

builder.Services.AddSingleton<OcrServiceJobRepository>();
builder.Services.AddSingleton<WorkerFileStorage>();
builder.Services.AddSingleton<PythonDependencyBootstrapper>();
builder.Services.AddSingleton<OcrPythonRunner>();
builder.Services.AddSingleton<OcrZoneFieldFillService>();
builder.Services.AddSingleton<OcrProcessor>();
builder.Services.AddHostedService<OcrWorkerHostedService>();

var host = builder.Build();
host.Run();
