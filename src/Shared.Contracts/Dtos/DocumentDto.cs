using Core.Domain.Enums;

namespace Shared.Contracts.Dtos;

public class DocumentDto
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SymbolNo { get; set; }
    public string? RecordNo { get; set; }
    public string? IssuedBy { get; set; }
    public DateTime? Issued { get; set; }
    public int? IssuedYear { get; set; }
    public string? Author { get; set; }
    public string? Noted { get; set; }
    public string? Field1 { get; set; }
    public string? Field2 { get; set; }
    public string? Field3 { get; set; }
    public string? Field4 { get; set; }
    public string? Field5 { get; set; }
    public string? Field6 { get; set; }
    public string? Field7 { get; set; }
    public string? Field8 { get; set; }
    public string? Checked1ReturnReason { get; set; }
    public string? Checked2ReturnReason { get; set; }
    public int DocTypeId { get; set; }
    public string? DocTypeName { get; set; }
    public int FolderId { get; set; }
    public string? FolderName { get; set; }
    public WorkflowStep CurrentStep { get; set; }
    public string CurrentStepName => CurrentStep.ToString();
    public DocumentStatus Status { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public string? ThumbPath { get; set; }
    public string? Extension { get; set; }
    public long FileSize { get; set; }
    public int PageCount { get; set; }
    public DateTime Created { get; set; }
    public string? CreatedByName { get; set; }
    public int CreatedBy { get; set; }
    public DateTime? ExtractedAt { get; set; }
    public int ExtractedBy { get; set; }
    public DateTime? Checked1At { get; set; }
    public int Checked1By { get; set; }
    public DateTime? Checked2At { get; set; }
    public int Checked2By { get; set; }

    // Workflow flags
    public bool IsCheckedScan1 { get; set; }
    public bool IsCheckedScan2 { get; set; }
    public bool IsZoned { get; set; }
    public bool IsExtracted { get; set; }
    public bool IsChecked1 { get; set; }
    public bool IsChecked2 { get; set; }
    public bool IsCheckedFinal { get; set; }
    public bool IsCheckedLogic { get; set; }
    public ExportStatus ExportStatus { get; set; }
}

public class DocumentCreateRequest
{
    public int ChannelId { get; set; }
    public int DocTypeId { get; set; }
    public int RecordTypeId { get; set; }
    public int ContentTypeId { get; set; }
    public int SyncTypeId { get; set; }
    public long FolderId { get; set; }
    public int DeptId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SymbolNo { get; set; }
    public string? RecordNo { get; set; }
    public string? IssuedBy { get; set; }
    public DateTime? Issued { get; set; }
    public int? IssuedYear { get; set; }
    public string? Author { get; set; }
    public string? Noted { get; set; }
    // Fields mở rộng
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
}

public class DocumentUpdateRequest : DocumentCreateRequest
{
    public long Id { get; set; }
    public string? Field11 { get; set; }
    public string? Field12 { get; set; }
    public string? Field13 { get; set; }
    public string? Field14 { get; set; }
    public string? Field15 { get; set; }
    public long? Field16 { get; set; }
    public long? Field17 { get; set; }
    public DateTime? Field21 { get; set; }
    public DateTime? Field22 { get; set; }
    public decimal? Field23 { get; set; }
}

public class DocumentFilterRequest : PageRequest
{
    public WorkflowStep? Step { get; set; }
    public int? DocTypeId { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public long? FolderId { get; set; }
}
