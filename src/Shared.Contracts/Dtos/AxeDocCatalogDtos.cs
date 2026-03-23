namespace Shared.Contracts.Dtos;

public class StgDocFieldDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; }
    public bool IsRecord { get; set; }
    public string Datatype { get; set; } = string.Empty;
    public string? CClass { get; set; }
}

public class StgDocFieldSettingDto
{
    public int Id { get; set; }
    public int IdType { get; set; }
    public int IdField { get; set; }
    public int IdPatternType { get; set; }
    public int IdCategoryType { get; set; }
    public int IdFieldGroup { get; set; }
    public int OcrType { get; set; }
    public string? IType { get; set; }
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

public class DocTypeFullDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public int ParentId { get; set; }
    public string? Parents { get; set; }
    public bool IsDefault { get; set; }
    public bool IsOcrManualZoned { get; set; }
    public int FieldQuantity { get; set; }
    public int SeparateTypeId { get; set; }
    public int Weight { get; set; }
    public byte ReviewStatus { get; set; }
}

public class DocTypeIndexRowDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? SeparateTypeName { get; set; }
    public string? ContentTypeName { get; set; }
    public byte ReviewStatus { get; set; }
}

public class CategoryTypeDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class PatternTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class StgDocFieldGroupDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? GroupName { get; set; }
    public int Weight { get; set; }
    public int IdParent { get; set; }
}

public class SeparateTypeRowDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class ContentTypeDocRowDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class DocTypeSeparateDto
{
    public long Id { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Weight { get; set; }
}

public class DocTypeSyncSettingDto
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

public class DocTypeSyncFullDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public int DocTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Format { get; set; }
    public int Weight { get; set; }
    public bool IsDefault { get; set; }
}

public class StgDocSoHoaOcrFixDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Type { get; set; }
    public string? FromStr { get; set; }
    public string? ToStr { get; set; }
    public int? FromPosition { get; set; }
    public int? ToPosition { get; set; }
    public string? Excepts { get; set; }
}

public class StgDocSoHoaOcrFixTypeDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
}
