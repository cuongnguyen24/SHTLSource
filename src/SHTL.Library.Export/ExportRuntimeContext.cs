namespace SHTL.Exporting;

/// <summary>Snapshot job export từ DB (worker độc lập, không tham chiếu SHTL.App).</summary>
public sealed class ExportJobContext
{
    public long Id { get; init; }
    public int ExportTypeId { get; init; }
    public string? ExportInputJson { get; init; }
    public int FieldFolderExport { get; init; }
}

/// <summary>Snapshot loại xuất từ DB.</summary>
public sealed class ExportTypeContext
{
    public int Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string? JsonConfig { get; init; }
}
