using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Shared.Contracts.Dtos;

/// <summary>Bản ghi danh sách job export (JOIN).</summary>
public sealed class ExportJobListRow
{
    public long Id { get; set; }
    public int ExportTypeId { get; set; }
    public string? Name { get; set; }
    public string? FilterJson { get; set; }
    public string? ExportInputJson { get; set; }
    public int FieldFolderExport { get; set; }
    public int DocStatus { get; set; }
    public bool IsExportFile { get; set; }
    public QueueStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int Total { get; set; }
    public int Processed { get; set; }
    public int Success { get; set; }
    public int Error { get; set; }
    public string? DownloadPath { get; set; }
    public string? Message { get; set; }
    public int RequestedBy { get; set; }
    public int? DeptId { get; set; }

    public string? ExportTypeName { get; set; }
    public string? RequestedByUserName { get; set; }
    public string? DeptName { get; set; }
}
