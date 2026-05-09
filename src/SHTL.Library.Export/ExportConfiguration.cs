using System.Text.Json;
using System.Text.Json.Serialization;

namespace SHTL.Exporting;

/// <summary>Cấu hình export (parity AXE DocProServiceExportLogic).</summary>
public class ExportConfiguration
{
    public string ProjectName { get; set; } = string.Empty;
    public string? ThuMucGoc { get; set; }
    public int SoThuMuc { get; set; }
    public string? ThuMucGocConfigKey { get; set; }
    public string? SoThuMucConfigKey { get; set; }
    public List<FieldFolderMapping> FieldFolderMappings { get; set; } = new();
    public List<int> DefaultDocTypeIds { get; set; } = new();
    public int? DefaultIDBia { get; set; } = 1;
    public int? DefaultIDVanBan { get; set; } = 2;
    public int? DefaultIDMucLuc { get; set; }
    public int? DefaultIDOther1 { get; set; }
    public bool UsePathBasedStructure { get; set; }
    public string? PathStructurePattern { get; set; }
    public string? XuatFileVatLyDoiTen { get; set; }
    public DataMappingConfig DataMapping { get; set; } = new();
    public Dictionary<string, JsonElement>? CustomSettings { get; set; }
    public List<ExcelFileConfig> ExcelFiles { get; set; } = new();
    public CoverConfig? CoverConfig { get; set; }
}

public class FieldFolderMapping
{
    public int Level { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ConfigKey { get; set; } = string.Empty;
}

public class DataMappingConfig
{
    public bool UseDynamicMapping { get; set; } = true;
    public string DynamicMappingSource { get; set; } = "StgDocFieldSetting";
    public List<StaticDataMapping> StaticMappings { get; set; } = new();
    public List<StaticDataMapping> StaticMappings1 { get; set; } = new();
    public List<StaticDataMapping> StaticMappings2 { get; set; } = new();
    public List<StaticDataMapping> StaticMappings3 { get; set; } = new();
    public List<StaticDataMapping> StaticMappings4 { get; set; } = new();
    public Dictionary<string, List<StaticDataMapping>> StaticMappingsDict { get; set; } = new();
    public string StaticMappingPriority { get; set; } = "After";
    public List<StaticDataMapping> CoverMappings { get; set; } = new();
    public List<StaticDataMapping> DocumentMappings { get; set; } = new();
    public CoverMatchConfig? CoverMatchConfig { get; set; }
}

public class StaticDataMapping
{
    public string? ColumnKey { get; set; }
    public string? ColumnTitle { get; set; }
    public int? Order { get; set; }
    public bool Hide { get; set; }

    [JsonPropertyName("isshowinfoBia")]
    public bool? IsShowInfoBia { get; set; }

    [JsonPropertyName("isshowinfoMucLuc")]
    public bool? IsShowInfoMucLuc { get; set; }

    [JsonPropertyName("isshowinfoOther1")]
    public bool? IsShowInfoOther1 { get; set; }

    public string? Transform { get; set; }
    public string? SourceField { get; set; }
    public List<string>? SourceFields { get; set; }
    public string? FallbackField { get; set; }
    public string? DefaultValue { get; set; }
    public FieldMergeConfig? MergeConfig { get; set; }
    public ValueTransformConfig? TransformConfig { get; set; }
    public StringFormatConfig? FormatConfig { get; set; }
    public PaddingConfig? PaddingConfig { get; set; }
}

public class ValueTransformConfig
{
    public string? LookupMode { get; set; }
    public string? MappingFile { get; set; }
    public string? SourceColumn { get; set; }
    public string? TargetColumn { get; set; }
    public string? KeyColumn1 { get; set; }
    public string? KeySource1 { get; set; }
    public string? KeyColumn2 { get; set; }
    public string? KeySource2 { get; set; }
    public string? ReturnColumn { get; set; }
    public Dictionary<string, string>? ValueMappings { get; set; }
    public bool CaseSensitive { get; set; }
    public string? DefaultValue { get; set; }
}

public class FieldMergeConfig
{
    public string? Pattern { get; set; }
    public string? Separator { get; set; }
    public bool SkipEmptyFields { get; set; } = true;
}

public class StringFormatConfig
{
    public string? Case { get; set; }
    public List<int>? CapitalizePositions { get; set; }
    public string? CasePattern { get; set; }
}

public class PaddingConfig
{
    public int TotalLength { get; set; }
    public string PaddingChar { get; set; } = "0";
    public string Position { get; set; } = "Left";
    public int? DecimalPlaces { get; set; }
    public string? NumberFormat { get; set; }
}

public class CoverMatchConfig
{
    public string? FileName { get; set; }
    public string MatchStrategy { get; set; } = "PathStructure";
    public List<int> PathMatchLevels { get; set; } = new();
    public bool CacheEnabled { get; set; } = true;
}

public class ExcelFileConfig
{
    public string FileName { get; set; } = string.Empty;
    public List<SheetConfig> Sheets { get; set; } = new();
}

public class SheetConfig
{
    public string SheetName { get; set; } = string.Empty;
    public string? StaticMappingsKey { get; set; }
    public List<int> DocTypeIds { get; set; } = new();
    public Dictionary<string, JsonElement>? FilterConditions { get; set; }
}

public class CoverConfig
{
    public string? FileName { get; set; }
    public string MatchStrategy { get; set; } = "PathStructure";
    public List<int> PathMatchLevels { get; set; } = new();
    public List<CoverFieldMapping> FieldMappings { get; set; } = new();
    public bool CacheEnabled { get; set; } = true;
}

public class CoverFieldMapping
{
    public string? SourceField { get; set; }
    public List<string>? SourceFields { get; set; }
    public FieldMergeConfig? MergeConfig { get; set; }
    public string? TargetColumnKey { get; set; }
    public string? TargetField { get; set; }
    public string? Transform { get; set; }
    public string? DefaultValue { get; set; }
}
