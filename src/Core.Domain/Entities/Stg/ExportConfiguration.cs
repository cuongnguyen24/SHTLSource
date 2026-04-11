namespace Core.Domain.Entities.Stg;

/// <summary>
/// Cấu hình export cho một loại xuất cụ thể
/// (Port từ AXE: DocProServiceExportLogic.Factories.ExporterDemo.Models.ExportConfiguration)
/// </summary>
public class ExportConfiguration
{
    /// <summary>Tên dự án (phải khớp với Code của ExportType)</summary>
    public string ProjectName { get; set; } = string.Empty;

    /// <summary>Tên thư mục gốc (ví dụ: "CSDL_SOHOA", "CSDL_SOHOA_TAILIEU")</summary>
    public string? ThuMucGoc { get; set; }

    /// <summary>Số lượng cấp thư mục (3, 5, 7, ...)</summary>
    public int SoThuMuc { get; set; }

    /// <summary>Mapping các cấp thư mục (Field Folder)</summary>
    public List<FieldFolderMapping> FieldFolderMappings { get; set; } = new();

    /// <summary>ID Bìa mặc định</summary>
    public int? DefaultIDBia { get; set; } = 1;

    /// <summary>ID Văn bản mặc định</summary>
    public int? DefaultIDVanBan { get; set; } = 2;

    /// <summary>ID Mục lục mặc định</summary>
    public int? DefaultIDMucLuc { get; set; }

    /// <summary>Sử dụng cấu trúc dựa trên Path thay vì query từ database fields</summary>
    public bool UsePathBasedStructure { get; set; } = false;

    /// <summary>Pattern để parse Path (chỉ dùng khi UsePathBasedStructure = true)</summary>
    public string? PathStructurePattern { get; set; }

    /// <summary>Cấu hình mapping dữ liệu</summary>
    public DataMappingConfig DataMapping { get; set; } = new();

    /// <summary>Cấu hình đặc thù khác (key-value pairs)</summary>
    public Dictionary<string, object> CustomSettings { get; set; } = new();

    /// <summary>Cấu hình xuất nhiều file Excel</summary>
    public List<ExcelFileConfig> ExcelFiles { get; set; } = new();

    /// <summary>Cấu hình bìa (Cover) cho tài liệu</summary>
    public CoverConfig? CoverConfig { get; set; }
}

/// <summary>Mapping cấp thư mục</summary>
public class FieldFolderMapping
{
    public int Level { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string FolderName { get; set; } = string.Empty;
    public int? MaxLength { get; set; }
    public string? PaddingChar { get; set; }
}

/// <summary>Cấu hình mapping dữ liệu</summary>
public class DataMappingConfig
{
    public bool UseDynamicMapping { get; set; } = true;
    public string DynamicMappingSource { get; set; } = "StgDocFieldSetting";
    public List<StaticDataMapping> StaticMappings { get; set; } = new();
    public List<StaticDataMapping> CoverMappings { get; set; } = new();
    public List<StaticDataMapping> DocumentMappings { get; set; } = new();
    public CoverMatchConfig? CoverMatchConfig { get; set; }
}

/// <summary>Static data mapping</summary>
public class StaticDataMapping
{
    public string SourceField { get; set; } = string.Empty;
    public string TargetColumn { get; set; } = string.Empty;
    public string? DefaultValue { get; set; }
    public TransformConfig? TransformConfig { get; set; }
}

/// <summary>Transform configuration</summary>
public class TransformConfig
{
    public string? MappingFile { get; set; }
    public string? SourceColumn { get; set; }
    public string? TargetColumn { get; set; }
    public bool CaseSensitive { get; set; }
}

/// <summary>Cover match configuration</summary>
public class CoverMatchConfig
{
    public string? FileName { get; set; }
    public string MatchStrategy { get; set; } = "PathStructure";
    public List<int> PathMatchLevels { get; set; } = new();
    public bool CacheEnabled { get; set; } = true;
}

/// <summary>Excel file configuration</summary>
public class ExcelFileConfig
{
    public string FileName { get; set; } = string.Empty;
    public List<ExcelSheetConfig> Sheets { get; set; } = new();
}

/// <summary>Excel sheet configuration</summary>
public class ExcelSheetConfig
{
    public string SheetName { get; set; } = string.Empty;
    public int StartRow { get; set; } = 1;
    public List<StaticDataMapping> ColumnMappings { get; set; } = new();
}

/// <summary>Cover configuration</summary>
public class CoverConfig
{
    public string? FileName { get; set; }
    public string MatchStrategy { get; set; } = "PathStructure";
    public List<int> PathMatchLevels { get; set; } = new();
}
