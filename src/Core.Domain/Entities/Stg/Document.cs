using Core.Domain.Enums;

namespace Core.Domain.Entities.Stg;

/// <summary>
/// Bảng trung tâm: Core_Stg.documents
/// Lưu tất cả thông tin của một tài liệu số hóa.
/// Trạng thái mỗi bước workflow được theo dõi bằng flag + timestamp riêng.
/// </summary>
public class Document : TenantEntity
{
    public long Id { get; set; }

    // ---------- Phân loại ----------
    public int DocTypeId { get; set; }
    public int RecordTypeId { get; set; }
    public int ContentTypeId { get; set; }
    public int SyncTypeId { get; set; }
    public long FolderId { get; set; }
    public int DeptId { get; set; }

    // ---------- Thông tin tài liệu ----------
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? SymbolNo { get; set; }
    public string? RecordNo { get; set; }
    public string? IssuedBy { get; set; }
    public DateTime? Issued { get; set; }
    public int? IssuedYear { get; set; }
    public string? Author { get; set; }
    public string? Signer { get; set; }
    public string? Noted { get; set; }
    public string? Summary { get; set; }
    public string? SearchMeta { get; set; }

    // ---------- File ----------
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public string? PathOriginal { get; set; }
    public string? PathConverted { get; set; }
    public string? PathPdfSearchable { get; set; }
    public string? ThumbPath { get; set; }
    public string? Extension { get; set; }
    public long FileSize { get; set; }
    public int PageCount { get; set; }
    public string? FileHash { get; set; }
    public bool IsColorScan { get; set; }
    public double MinDpi { get; set; }
    public double MaxDpi { get; set; }
    public string? VersionPdf { get; set; }
    public string? WorkstationName { get; set; }

    // ---------- Trạng thái chung ----------
    public DocumentStatus Status { get; set; } = DocumentStatus.Active;
    public WorkflowStep CurrentStep { get; set; } = WorkflowStep.Scan;
    public WorkflowStep LockedByStep { get; set; } = WorkflowStep.None;
    public DateTime? LockedAt { get; set; }
    public int LockedByUserId { get; set; }

    // ---------- BƯỚC 1: Check Scan lần 1 ----------
    public bool IsCheckedScan1 { get; set; }
    public DateTime? CheckedScan1At { get; set; }
    public int CheckedScan1By { get; set; }
    public StepResult CheckedScan1Result { get; set; }

    // ---------- BƯỚC 2: Check Scan lần 2 ----------
    public bool IsCheckedScan2 { get; set; }
    public DateTime? CheckedScan2At { get; set; }
    public int CheckedScan2By { get; set; }
    public StepResult CheckedScan2Result { get; set; }

    // ---------- BƯỚC 3: Khoanh vùng ----------
    public bool IsZoned { get; set; }
    public DateTime? ZonedAt { get; set; }
    public int ZonedBy { get; set; }
    public StepResult ZonedResult { get; set; }

    // ---------- BƯỚC 4: OCR ----------
    public OcrStatus OcrStatus { get; set; } = OcrStatus.NotRequested;
    public bool IsOcrEnabled { get; set; }
    public DateTime? OcrAt { get; set; }
    public int OcrBy { get; set; }
    public byte OcrResult { get; set; }

    // ---------- BƯỚC 5: Nhập liệu / Extract ----------
    public bool IsExtracted { get; set; }
    public DateTime? ExtractedAt { get; set; }
    public int ExtractedBy { get; set; }
    public StepResult ExtractedResult { get; set; }
    public int ExtractedReturnCount { get; set; }
    public string? ExtractedReturnReason { get; set; }

    // ---------- BƯỚC 6: Kiểm tra lần 1 ----------
    public bool IsChecked1 { get; set; }
    public DateTime? Checked1At { get; set; }
    public int Checked1By { get; set; }
    public StepResult Checked1Result { get; set; }
    public int Checked1ReturnCount { get; set; }
    public string? Checked1ReturnReason { get; set; }

    // ---------- BƯỚC 7: Kiểm tra lần 2 ----------
    public bool IsChecked2 { get; set; }
    public DateTime? Checked2At { get; set; }
    public int Checked2By { get; set; }
    public StepResult Checked2Result { get; set; }
    public string? Checked2ReturnReason { get; set; }

    // ---------- BƯỚC 8: Kiểm tra cuối ----------
    public bool IsCheckedFinal { get; set; }
    public DateTime? CheckedFinalAt { get; set; }
    public int CheckedFinalBy { get; set; }
    public StepResult CheckedFinalResult { get; set; }
    public string? CheckedFinalChangeInfo { get; set; }

    // ---------- BƯỚC 9: Kiểm tra logic ----------
    public bool IsCheckedLogic { get; set; }
    public DateTime? CheckedLogicAt { get; set; }
    public int CheckedLogicBy { get; set; }
    public StepResult CheckedLogicResult { get; set; }

    // ---------- Export ----------
    public ExportStatus ExportStatus { get; set; }
    public DateTime? ExportedAt { get; set; }
    public int ExportedBy { get; set; }
    public long ExcelMetadataId { get; set; }

    // ---------- Page size stats ----------
    public int PageCountA4 { get; set; }
    public int PageCountA3 { get; set; }
    public int PageCountA2 { get; set; }
    public int PageCountA1 { get; set; }
    public int PageCountA0 { get; set; }
    public int PageCountOther { get; set; }

    // ---------- Fields mở rộng (dùng cho metadata động) ----------
    public string? Field1 { get; set; }
    public string? Field2 { get; set; }
    public string? Field3 { get; set; }
    public string? Field4 { get; set; }
    public string? Field5 { get; set; }
    public string? Field6 { get; set; }
    public string? Field7 { get; set; }
    public string? Field8 { get; set; }
    public string? Field9 { get; set; }
    public string? Field10 { get; set; }
    public string? Field11 { get; set; }
    public string? Field12 { get; set; }
    public string? Field13 { get; set; }
    public string? Field14 { get; set; }
    public string? Field15 { get; set; }
    public long? Field16 { get; set; }
    public long? Field17 { get; set; }
    public long? Field18 { get; set; }
    public long? Field19 { get; set; }
    public long? Field20 { get; set; }
    public DateTime? Field21 { get; set; }
    public DateTime? Field22 { get; set; }
    public decimal? Field23 { get; set; }
    public decimal? Field24 { get; set; }
    public decimal? Field25 { get; set; }

    // Có thể mở rộng thêm field theo nhu cầu
    public string? SortMeta { get; set; }
    public int Version { get; set; } = 1;
    public int Weight { get; set; }
}
