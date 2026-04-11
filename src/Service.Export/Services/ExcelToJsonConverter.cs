using ClosedXML.Excel;
using Core.Domain.Entities.Stg;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Service.Export.Services;

/// <summary>
/// Service chuyển đổi Excel config sang JSON
/// (Port từ AXE: ExportTypeController.ConvertExcelToJson)
/// </summary>
public class ExcelToJsonConverter
{
    private readonly ILogger<ExcelToJsonConverter> _logger;

    public ExcelToJsonConverter(ILogger<ExcelToJsonConverter> logger)
    {
        _logger = logger;
    }

    /// <summary>Convert Excel file to ExportConfiguration JSON</summary>
    public async Task<string> ConvertAsync(string excelFilePath, string projectName)
    {
        try
        {
            _logger.LogInformation("Converting Excel to JSON: {FilePath}", excelFilePath);

            if (!File.Exists(excelFilePath))
                throw new FileNotFoundException($"Excel file not found: {excelFilePath}");

            var config = await Task.Run(() => ParseExcelToConfig(excelFilePath, projectName));
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            _logger.LogInformation("Converted Excel to JSON successfully");
            return json;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert Excel to JSON");
            throw;
        }
    }

    /// <summary>Parse Excel file to ExportConfiguration</summary>
    private ExportConfiguration ParseExcelToConfig(string excelFilePath, string projectName)
    {
        using var workbook = new XLWorkbook(excelFilePath);
        
        var config = new ExportConfiguration
        {
            ProjectName = projectName
        };

        // Sheet 1: General Settings
        if (workbook.Worksheets.Contains("Settings") || workbook.Worksheets.Count > 0)
        {
            var sheet = workbook.Worksheets.Contains("Settings") 
                ? workbook.Worksheet("Settings") 
                : workbook.Worksheet(1);
            
            ParseSettingsSheet(sheet, config);
        }

        // Sheet 2: Field Folder Mappings
        if (workbook.Worksheets.Contains("FieldFolders"))
        {
            var sheet = workbook.Worksheet("FieldFolders");
            ParseFieldFolderSheet(sheet, config);
        }

        // Sheet 3: Data Mappings
        if (workbook.Worksheets.Contains("DataMappings"))
        {
            var sheet = workbook.Worksheet("DataMappings");
            ParseDataMappingSheet(sheet, config);
        }

        return config;
    }

    /// <summary>Parse Settings sheet</summary>
    private void ParseSettingsSheet(IXLWorksheet sheet, ExportConfiguration config)
    {
        // Đọc các setting theo format: Key | Value
        var rows = sheet.RowsUsed().Skip(1); // Skip header
        
        foreach (var row in rows)
        {
            var key = row.Cell(1).GetString().Trim();
            var value = row.Cell(2).GetString().Trim();

            if (string.IsNullOrEmpty(key)) continue;

            switch (key.ToLower())
            {
                case "thumucgoc":
                    config.ThuMucGoc = value;
                    break;
                case "sothumuc":
                    config.SoThuMuc = int.TryParse(value, out var soThuMuc) ? soThuMuc : 0;
                    break;
                case "defaultidbia":
                    config.DefaultIDBia = int.TryParse(value, out var idBia) ? idBia : 1;
                    break;
                case "defaultidvanban":
                    config.DefaultIDVanBan = int.TryParse(value, out var idVanBan) ? idVanBan : 2;
                    break;
                case "defaultidmucluc":
                    config.DefaultIDMucLuc = int.TryParse(value, out var idMucLuc) ? idMucLuc : (int?)null;
                    break;
                case "usepathbasedstructure":
                    config.UsePathBasedStructure = value.ToLower() == "true" || value == "1";
                    break;
                case "pathstructurepattern":
                    config.PathStructurePattern = value;
                    break;
            }
        }
    }

    /// <summary>Parse FieldFolder sheet</summary>
    private void ParseFieldFolderSheet(IXLWorksheet sheet, ExportConfiguration config)
    {
        // Format: Level | FieldName | FolderName | MaxLength | PaddingChar
        var rows = sheet.RowsUsed().Skip(1); // Skip header
        
        foreach (var row in rows)
        {
            var level = row.Cell(1).GetValue<int>();
            var fieldName = row.Cell(2).GetString().Trim();
            var folderName = row.Cell(3).GetString().Trim();
            var maxLength = row.Cell(4).TryGetValue(out int ml) ? (int?)ml : null;
            var paddingChar = row.Cell(5).GetString().Trim();

            if (level <= 0 || string.IsNullOrEmpty(fieldName)) continue;

            config.FieldFolderMappings.Add(new FieldFolderMapping
            {
                Level = level,
                FieldName = fieldName,
                FolderName = folderName,
                MaxLength = maxLength,
                PaddingChar = string.IsNullOrEmpty(paddingChar) ? null : paddingChar
            });
        }
    }

    /// <summary>Parse DataMapping sheet</summary>
    private void ParseDataMappingSheet(IXLWorksheet sheet, ExportConfiguration config)
    {
        // Format: SourceField | TargetColumn | DefaultValue | MappingFile | SourceColumn | TargetColumn | CaseSensitive
        var rows = sheet.RowsUsed().Skip(1); // Skip header
        
        foreach (var row in rows)
        {
            var sourceField = row.Cell(1).GetString().Trim();
            var targetColumn = row.Cell(2).GetString().Trim();
            var defaultValue = row.Cell(3).GetString().Trim();
            var mappingFile = row.Cell(4).GetString().Trim();
            var sourceColumn = row.Cell(5).GetString().Trim();
            var targetColumnMapping = row.Cell(6).GetString().Trim();
            var caseSensitive = row.Cell(7).GetString().Trim().ToLower() == "true";

            if (string.IsNullOrEmpty(sourceField) || string.IsNullOrEmpty(targetColumn)) continue;

            var mapping = new StaticDataMapping
            {
                SourceField = sourceField,
                TargetColumn = targetColumn,
                DefaultValue = string.IsNullOrEmpty(defaultValue) ? null : defaultValue
            };

            if (!string.IsNullOrEmpty(mappingFile))
            {
                mapping.TransformConfig = new TransformConfig
                {
                    MappingFile = mappingFile,
                    SourceColumn = sourceColumn,
                    TargetColumn = targetColumnMapping,
                    CaseSensitive = caseSensitive
                };
            }

            config.DataMapping.DocumentMappings.Add(mapping);
        }
    }
}
