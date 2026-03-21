using Core.Application;
using Infrastructure.Data;
using Infrastructure.Storage;
using System.IO;
using Service.Export;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"), optional: false, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddInfrastructureStorage(builder.Configuration);
builder.Services.AddCoreApplication();

builder.Services.AddHostedService<ExportWorker>();

var host = builder.Build();
host.Run();
