namespace Core.Domain.Entities.Stg;

/// <summary>Bảng: Core_Stg.document_folders</summary>
public class DocumentFolder : TenantEntity
{
    public long Id { get; set; }
    public int SyncTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Deep { get; set; }
    public long Parent { get; set; }
    public string? Parents { get; set; }
    public int Weight { get; set; }
    public long FileCount { get; set; }
    public string? PathFolder { get; set; }
    public string? Describe { get; set; }
}

/// <summary>Bảng: core_stg.doc_types (loại tài liệu). Cột extractor_type_id trong DB dự phòng gán loại trích xuất (UI/API sẽ bổ sung sau).</summary>
public class DocType : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public bool IsDefault { get; set; }
    public int Parent { get; set; }
    public string? Parents { get; set; }
    public int DeptId { get; set; }
    public int Weight { get; set; }
    public bool IsOcrManualZoned { get; set; }
    public int FieldQuantity { get; set; }
    public int SeparateTypeId { get; set; }
    /// <summary>Dự phòng — đồng bộ với cột extractor_type_id khi triển khai loại trích xuất.</summary>
    public int? ExtractorTypeId { get; set; }
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Stg.doc_type_sync_types - cấu hình sync theo loại tài liệu</summary>
public class DocTypeSyncType : TenantEntity
{
    public int Id { get; set; }
    public int DocTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Format { get; set; }
    public bool IsDefault { get; set; }
    public int Weight { get; set; }
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Stg.doc_shares</summary>
public class DocumentShare
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long DocumentId { get; set; }
    public int SharedToUserId { get; set; }
    public int SharedToDeptId { get; set; }
    public int SharedToTeamId { get; set; }
    public bool IsPublic { get; set; }
    public bool CanEdit { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CreatedBy { get; set; }
}
