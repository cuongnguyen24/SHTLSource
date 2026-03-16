using Core.Domain.Enums;

namespace Core.Domain.Entities.Stg;

/// <summary>Bảng: Core_Stg.ocr_jobs - queue xử lý OCR</summary>
public class OcrJob
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long DocumentId { get; set; }
    public QueueType Type { get; set; } = QueueType.Ocr;
    public QueueStatus Status { get; set; } = QueueStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Message { get; set; }
    public int RetryCount { get; set; }
    public int Priority { get; set; }
}

/// <summary>Bảng: Core_Stg.export_jobs - queue export dữ liệu</summary>
public class ExportJob
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public string? ExportType { get; set; }
    public string? FilterJson { get; set; }
    public QueueStatus Status { get; set; } = QueueStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int Total { get; set; }
    public int Processed { get; set; }
    public int Success { get; set; }
    public int Error { get; set; }
    public string? DownloadPath { get; set; }
    public string? Message { get; set; }
    public int RequestedBy { get; set; }
}

/// <summary>Bảng: Core_Stg.delete_file_jobs - queue xóa file</summary>
public class DeleteFileJob
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long DocumentId { get; set; }
    public string? FilePath { get; set; }
    public QueueStatus Status { get; set; } = QueueStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public string? Message { get; set; }
    public int RequestedBy { get; set; }
}

/// <summary>Bảng: Core_Stg.import_excel_jobs - queue import Excel</summary>
public class ImportExcelJob
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string? OriginalFileName { get; set; }
    public QueueStatus Status { get; set; } = QueueStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public int Total { get; set; }
    public int Success { get; set; }
    public int Error { get; set; }
    public string? Message { get; set; }
    public int RequestedBy { get; set; }
}

/// <summary>Bảng: Core_Stg.excel_metadata_files - file Excel metadata</summary>
public class ExcelMetadataFile : TenantEntity
{
    public long Id { get; set; }
    public int DocTypeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ImportedRows { get; set; }
    public string? Description { get; set; }
}

/// <summary>Bảng: Core_Stg.excel_metadata - từng dòng metadata từ Excel</summary>
public class ExcelMetadata
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long ExcelMetadataFileId { get; set; }
    public long DocumentId { get; set; }
    public int RowIndex { get; set; }
    public string? DataJson { get; set; }
    public bool IsMatched { get; set; }
    public DateTime CreatedAt { get; set; }
}
