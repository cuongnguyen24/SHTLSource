namespace Core.Domain.Entities.Catalog;

/// <summary>Bảng: Core_Catalog.provinces</summary>
public class Province
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Catalog.districts</summary>
public class District
{
    public int Id { get; set; }
    public int ProvinceId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Catalog.wards</summary>
public class Ward
{
    public int Id { get; set; }
    public int DistrictId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Catalog.name_libraries - thư viện tên người</summary>
public class NameLibrary
{
    public long Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public int UsageCount { get; set; }
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Catalog.categories</summary>
public class Category
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public int Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public int Parent { get; set; }
    public string? Parents { get; set; }
    public int Weight { get; set; }
    public bool IsActive { get; set; } = true;
}
