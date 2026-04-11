using Core.Domain.Entities.Stg;
using Core.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using System.IO.Compression;

namespace Service.Export.Exporters;

/// <summary>
/// Base exporter chứa logic chung cho các exporter
/// (Port từ AXE: DocProServiceExportLogic.Factories.ExporterDemo.BaseExporterDemo)
/// </summary>
public abstract class BaseExporter
{
    protected readonly ILogger _logger;
    protected readonly IConfiguration _config;
    protected ExportJob Queue { get; set; }
    protected ExportType ExportType { get; set; }
    protected ExportConfiguration Config { get; set; } = null!;
    protected ExportInput Input { get; set; } = null!;
    protected string JobId { get; set; }
    protected string SourcePath { get; set; } = null!;
    protected string TargetPath { get; set; } = null!;
    protected int FieldFolderExport { get; set; }

    protected BaseExporter(
        ILogger logger,
        IConfiguration config,
        ExportJob queue,
        ExportType exportType)
    {
        _logger = logger;
        _config = config;
        Queue = queue;
        ExportType = exportType;
        JobId = $"{queue.Id}_{DateTime.UtcNow:yyyyMMdd_HHmmss}";
    }

    /// <summary>Entry point - thực thi export</summary>
    public async Task<ExportResult> ExecuteAsync()
    {
        try
        {
            _logger.LogInformation("BaseExporter.ExecuteAsync started for Job {JobId}", JobId);

            // 1. Load configuration
            LoadConfiguration();

            // 2. Validate paths
            ValidatePaths();

            // 3. Parse input
            ParseInput();

            // 4. Execute export logic (override by subclass)
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

    #region Configuration

    /// <summary>Load cấu hình từ ExportType.JsonConfig</summary>
    protected virtual void LoadConfiguration()
    {
        try
        {
            if (string.IsNullOrEmpty(ExportType.JsonConfig))
            {
                throw new Exception($"ExportType {ExportType.Code} không có JsonConfig");
            }

            Config = JsonSerializer.Deserialize<ExportConfiguration>(ExportType.JsonConfig)
                ?? throw new Exception("Không thể parse JsonConfig");

            ValidateConfiguration();

            _logger.LogInformation("Loaded configuration for project: {ProjectName}", Config.ProjectName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LoadConfiguration failed");
            throw;
        }
    }

    /// <summary>Validate configuration</summary>
    protected virtual void ValidateConfiguration()
    {
        if (string.IsNullOrEmpty(Config.ProjectName))
            throw new Exception("ProjectName không được để trống");

        if (string.IsNullOrEmpty(Config.ThuMucGoc))
            throw new Exception("ThuMucGoc không được để trống");

        if (Config.SoThuMuc <= 0)
            throw new Exception("SoThuMuc phải lớn hơn 0");

        if (Config.FieldFolderMappings == null || Config.FieldFolderMappings.Count == 0)
            throw new Exception("FieldFolderMappings không được để trống");
    }

    #endregion

    #region Paths

    /// <summary>Validate và setup paths</summary>
    protected virtual void ValidatePaths()
    {
        SourcePath = _config["Storage:BasePath"] ?? throw new Exception("Storage:BasePath not configured");
        TargetPath = Path.Combine(SourcePath, "EXPORT", JobId);

        if (!Directory.Exists(SourcePath))
            throw new Exception($"SourcePath không tồn tại: {SourcePath}");

        Directory.CreateDirectory(TargetPath);

        _logger.LogInformation("Paths - Source: {SourcePath}, Target: {TargetPath}", SourcePath, TargetPath);
    }

    #endregion

    #region Input Parsing

    /// <summary>Parse ExportInputJson từ Queue</summary>
    protected virtual void ParseInput()
    {
        Input = new ExportInput();
        FieldFolderExport = Queue.FieldFolderExport;

        if (string.IsNullOrEmpty(Queue.ExportInputJson))
            return;

        try
        {
            var inputDict = JsonSerializer.Deserialize<Dictionary<string, string>>(Queue.ExportInputJson);
            if (inputDict == null) return;

            // Parse FieldFolder inputs
            for (int i = 1; i <= 10; i++)
            {
                var key = $"FieldFolder{i}_Field";
                if (inputDict.TryGetValue(key, out var value) && !string.IsNullOrEmpty(value))
                {
                    typeof(ExportInput).GetProperty(key)?.SetValue(Input, value);
                }
            }

            _logger.LogInformation("Parsed input - FieldFolderExport: {FieldFolderExport}", FieldFolderExport);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ParseInput failed");
        }
    }

    #endregion

    #region Abstract Methods

    /// <summary>Execute export logic - override by subclass</summary>
    protected abstract Task<ExportResult> ExecuteExportAsync();

    #endregion

    #region Helper Methods

    /// <summary>Compress folder to ZIP</summary>
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

    /// <summary>Get field value from document by field name</summary>
    protected string? GetFieldValue(Document doc, string fieldName)
    {
        if (string.IsNullOrEmpty(fieldName))
            return null;

        var prop = typeof(Document).GetProperty(fieldName);
        if (prop == null)
            return null;

        var value = prop.GetValue(doc);
        return value?.ToString();
    }

    #endregion
}

/// <summary>Export input từ Queue.ExportInputJson</summary>
public class ExportInput
{
    public string? FieldFolder1_Field { get; set; }
    public string? FieldFolder2_Field { get; set; }
    public string? FieldFolder3_Field { get; set; }
    public string? FieldFolder4_Field { get; set; }
    public string? FieldFolder5_Field { get; set; }
    public string? FieldFolder6_Field { get; set; }
    public string? FieldFolder7_Field { get; set; }
    public string? FieldFolder8_Field { get; set; }
    public string? FieldFolder9_Field { get; set; }
    public string? FieldFolder10_Field { get; set; }
}

/// <summary>Export result</summary>
public class ExportResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? DownloadPath { get; set; }
    public string? DownloadLogPath { get; set; }
    public int Total { get; set; }
    public int Processed { get; set; }
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public string? Error { get; set; }
}
