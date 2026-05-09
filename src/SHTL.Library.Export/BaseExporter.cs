using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.IO.Compression;

namespace SHTL.Exporting;

/// <summary>Base exporter — worker Service.Export hoặc tích hợp khác. Mở rộng: <see cref="BaseExporterDemo"/>.</summary>
public abstract class BaseExporter
{
    protected readonly ILogger _logger;
    protected readonly IConfiguration _config;
    protected ExportJobContext Queue { get; set; } = null!;
    protected ExportTypeContext ExportType { get; set; } = null!;
    protected ExportConfiguration Config { get; set; } = null!;
    protected ExportInput Input { get; set; } = null!;
    protected string JobId { get; set; } = null!;
    protected string SourcePath { get; set; } = null!;
    protected string TargetPath { get; set; } = null!;
    protected int FieldFolderExport { get; set; }

    protected BaseExporter(
        ILogger logger,
        IConfiguration config,
        ExportJobContext queue,
        ExportTypeContext exportType)
    {
        _logger = logger;
        _config = config;
        Queue = queue;
        ExportType = exportType;
        JobId = $"{queue.Id}_{DateTime.UtcNow:yyyyMMdd_HHmmss}";
    }

    public async Task<ExportResult> ExecuteAsync()
    {
        try
        {
            _logger.LogInformation(
                "BaseExporter.ExecuteAsync started for Job {JobId} exportType={ExportType} queueId={QueueId}",
                JobId,
                ExportType.Code,
                Queue.Id);

            LoadConfiguration();
            ValidatePaths();
            ParseInput();

            var result = await ExecuteExportAsync();

            _logger.LogInformation("BaseExporter.ExecuteAsync completed for Job {JobId}", JobId);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BaseExporter.ExecuteAsync failed for Job {JobId}", JobId);
            return new ExportResult
            {
                Success = false,
                Message = $"Export failed: {ex.Message}",
                Error = ex.ToString()
            };
        }
    }

    protected virtual string? GetConfigurationJson() => ExportType.JsonConfig;

    protected virtual void OnConfigurationLoaded() { }

    protected virtual void LoadConfiguration()
    {
        try
        {
            var jsonContent = GetConfigurationJson();
            if (string.IsNullOrEmpty(jsonContent))
                throw new InvalidOperationException(
                    $"ExportType {ExportType.Code} không có JsonConfig và không tìm thấy file cấu hình fallback.");

            Config = JsonSerializer.Deserialize<ExportConfiguration>(jsonContent, ExportJson.DeserializeOptions)
                     ?? throw new InvalidOperationException("Không thể parse JsonConfig");

            ValidateConfiguration();
            OnConfigurationLoaded();

            _logger.LogInformation("Loaded configuration for project: {ProjectName}", Config.ProjectName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LoadConfiguration failed");
            throw;
        }
    }

    protected virtual void ValidateConfiguration()
    {
        if (string.IsNullOrEmpty(Config.ProjectName))
            throw new InvalidOperationException("ProjectName không được để trống");

        if (string.IsNullOrEmpty(Config.ThuMucGoc))
            throw new InvalidOperationException("ThuMucGoc không được để trống");

        if (Config.SoThuMuc <= 0)
            throw new InvalidOperationException("SoThuMuc phải lớn hơn 0");

        if (Config.FieldFolderMappings == null || Config.FieldFolderMappings.Count == 0)
            throw new InvalidOperationException("FieldFolderMappings không được để trống");
    }

    protected virtual void ValidatePaths()
    {
        SourcePath = _config["Storage:RootPath"] ?? _config["Storage:BasePath"]
            ?? throw new InvalidOperationException("Cấu hình Storage:RootPath (hoặc Storage:BasePath) là bắt buộc.");
        TargetPath = Path.Combine(SourcePath, "EXPORT", JobId);

        if (!Directory.Exists(SourcePath))
            throw new InvalidOperationException($"SourcePath không tồn tại: {SourcePath}");

        Directory.CreateDirectory(TargetPath);

        _logger.LogInformation("Paths - Source: {SourcePath}, Target: {TargetPath}", SourcePath, TargetPath);
    }

    protected virtual void ParseInput()
    {
        Input = new ExportInput();
        FieldFolderExport = Queue.FieldFolderExport;

        if (string.IsNullOrEmpty(Queue.ExportInputJson))
            return;

        try
        {
            var parsed = JsonSerializer.Deserialize<ExportInput>(Queue.ExportInputJson, ExportJson.DeserializeOptions);
            if (parsed != null)
                Input = parsed;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ParseInput failed; using empty ExportInput");
        }
    }

    protected abstract Task<ExportResult> ExecuteExportAsync();

    protected async Task<string> CompressFolderAsync(string folderPath, string zipFileName)
    {
        var zipPath = Path.Combine(Path.GetDirectoryName(folderPath)!, zipFileName);

        await Task.Run(() =>
        {
            if (File.Exists(zipPath))
                File.Delete(zipPath);

            ZipFile.CreateFromDirectory(folderPath, zipPath, CompressionLevel.Optimal, false);
        });

        _logger.LogInformation("Compressed folder to: {ZipPath}", zipPath);
        return zipPath;
    }

    /// <summary>Lấy giá trị property theo tên (Field1, Name, …) — dùng cho dòng tài liệu bất kỳ.</summary>
    protected string? GetFieldValue(object? entity, string fieldName)
    {
        if (entity == null || string.IsNullOrEmpty(fieldName))
            return null;

        var prop = entity.GetType().GetProperty(fieldName);
        if (prop == null)
            return null;

        var value = prop.GetValue(entity);
        return value?.ToString();
    }
}
