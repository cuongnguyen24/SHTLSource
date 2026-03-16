using Infrastructure.Data;
using System.IO;
using Worker.Ocr;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile(Path.Combine("..", "config", "connectionstrings.json"), optional: false, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddHostedService<OcrWorker>();

var host = builder.Build();
host.Run();
