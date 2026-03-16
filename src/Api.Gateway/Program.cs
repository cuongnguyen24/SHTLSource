using Core.Application;
using Infrastructure.Data;
using Infrastructure.Identity;
using Infrastructure.Storage;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine("..", "config", "connectionstrings.json"), optional: false, reloadOnChange: true);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddInfrastructureData(builder.Configuration);
builder.Services.AddInfrastructureIdentity();
builder.Services.AddInfrastructureStorage(builder.Configuration);
builder.Services.AddCoreApplication();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.MapControllers();

app.Run();
