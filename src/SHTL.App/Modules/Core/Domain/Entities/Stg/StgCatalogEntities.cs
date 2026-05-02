namespace SHTL.Modules.Core.Domain.Entities.Stg;

/// <summary>dbo.stg_doc_types</summary>
public class StgDocType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public int? ParentId { get; set; }
    public string? Parents { get; set; }
    public bool IsDefault { get; set; }
    public bool IsOcrManualZoned { get; set; }
    public int FieldQuantity { get; set; }
    public int SeparateTypeId { get; set; }
    public int ExtractorTypeId { get; set; }
    public int Weight { get; set; }
    public int ReviewStatus { get; set; }
    public DateTime Created { get; set; }
    public int CreatedBy { get; set; }
    public DateTime? Updated { get; set; }
    public int UpdatedBy { get; set; }
}

/// <summary>dbo.stg_doc_type_sync_types</summary>
public class StgDocTypeSyncType
{
    public int Id { get; set; }
    public int DocTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Format { get; set; }
    public string? ScanPathRoot { get; set; }
    public int Weight { get; set; }
    public bool IsDefault { get; set; }
    public DateTime Created { get; set; }
    public int CreatedBy { get; set; }
    public DateTime? Updated { get; set; }
    public int UpdatedBy { get; set; }
}

/// <summary>dbo.stg_doc_type_sync_settings</summary>
public class StgDocTypeSyncSetting
{
    public int Id { get; set; }
    public int IdType { get; set; }
    public int IdField { get; set; }
    public int IdPatternType { get; set; }
    public string? Title { get; set; }
    public int Weight { get; set; }
    public bool IsCatalog { get; set; }
    public string? PatternCustom { get; set; }
    public string? FixValue { get; set; }
    public string? MinValue { get; set; }
    public string? MaxValue { get; set; }
    public int MinLen { get; set; }
    public int MaxLen { get; set; }
    public bool IsRequired { get; set; }
}

/// <summary>dbo.stg_doc_fields — danh mục field toàn cục.</summary>
public class StgDocField
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Title { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; }
    public bool IsRecord { get; set; }
    public int Datatype { get; set; }
    public string? CClass { get; set; }
}

/// <summary>dbo.stg_doc_field_settings</summary>
public class StgDocFieldSetting
{
    public int Id { get; set; }
    public int IdType { get; set; }
    public int IdField { get; set; }
    public int IdPatternType { get; set; }
    public int IdCategoryType { get; set; }
    public int IdFieldGroup { get; set; }
    public int OcrType { get; set; }
    public int IType { get; set; }
    public int IRow { get; set; }
    public int ICol { get; set; }
    public string? Title { get; set; }
    public int Weight { get; set; }
    public bool IsMulti { get; set; }
    public bool IsSearch { get; set; }
    public bool IsCatalog { get; set; }
    public bool IsCatalogMain { get; set; }
    public string? PatternCustom { get; set; }
    public string? FixValue { get; set; }
    public string? MinValue { get; set; }
    public string? MaxValue { get; set; }
    public int MinLen { get; set; }
    public int MaxLen { get; set; }
    public bool IsRequired { get; set; }
    public bool IsReadOnly { get; set; }
    public bool IsUpperCase { get; set; }
    public bool IsCapitalize { get; set; }
    public string? Format { get; set; }
    public bool IsOcrFix { get; set; }
}

/// <summary>dbo.stg_category_types</summary>
public class StgCategoryType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Weight { get; set; }
}

/// <summary>dbo.stg_pattern_types</summary>
public class StgPatternType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>dbo.stg_doc_field_groups</summary>
public class StgDocFieldGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? GroupName { get; set; }
    public int Weight { get; set; }
    public int IdParent { get; set; }
}

/// <summary>dbo.stg_doc_type_separates</summary>
public class StgDocTypeSeparate
{
    public int Id { get; set; }
    public int IdDoctype { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Weight { get; set; }
}

/// <summary>dbo.stg_doc_sohoa_ocr_fixes</summary>
public class StgDocSoHoaOcrFix
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Type { get; set; }
    public string? FromStr { get; set; }
    public string? ToStr { get; set; }
    public int FromPosition { get; set; }
    public int ToPosition { get; set; }
    public string? Excepts { get; set; }
}

/// <summary>dbo.stg_doc_sohoa_ocr_fix_types</summary>
public class StgDocSoHoaOcrFixType
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
}

/// <summary>dbo.stg_doc_type_ocr_fixes</summary>
public class StgDocTypeOcrFix
{
    public int Id { get; set; }
    public int IdDoctype { get; set; }
    public int IdField { get; set; }
    public int IdOcrFix { get; set; }
    public int Weight { get; set; }
}
