namespace Core.Domain.Entities.Cnf;

/// <summary>Bảng: Core_Cnf.channels</summary>
public class Channel : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Url { get; set; }
    public string? Lang { get; set; }
    public string? Logo { get; set; }
    public int Weight { get; set; }
    public int Parent { get; set; }
    public string? Parents { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int AccountLimit { get; set; }
    public long StorageLimit { get; set; }
    public long DocumentLimit { get; set; }
    public bool IsPublished { get; set; }
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Cnf.configs - cấu hình hệ thống theo channel</summary>
public class SystemConfig
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public string? Group { get; set; }
    public string? Description { get; set; }
}

/// <summary>Bảng: Core_Cnf.content_types</summary>
public class ContentType : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Cnf.record_types</summary>
public class RecordType : TenantEntity
{
    public int Id { get; set; }
    public int ContentTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public int Weight { get; set; }
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Cnf.sync_types</summary>
public class SyncType : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public int Weight { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Bảng: Core_Cnf.export_types</summary>
public class ExportType : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? ExporterClass { get; set; }
    public string? Describe { get; set; }
    public int Weight { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Bảng: Core_Cnf.translations</summary>
public class Translation
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Lang { get; set; } = "vi";
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
}
