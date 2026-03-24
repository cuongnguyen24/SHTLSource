using Core.Domain.Enums;

namespace Shared.Contracts.Dtos;

public class WorkflowActionRequest
{
    public long DocumentId { get; set; }
    public WorkflowStep Step { get; set; }
    public StepResult Result { get; set; }
    public string? Note { get; set; }
    public string? ReturnReason { get; set; }
}

public class CheckReviewRequest : WorkflowActionRequest
{
    public string? Name { get; set; }
    public string? SymbolNo { get; set; }
    public string? RecordNo { get; set; }
    public string? IssuedBy { get; set; }
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
    public List<FormCellValueDto> Cells { get; set; } = new();
}

public class CheckScanRequest
{
    public long DocumentId { get; set; }
    public StepResult Result { get; set; }
    public string? Note { get; set; }
    public int PageCount { get; set; }
    public int PageCountA4 { get; set; }
    public int PageCountA3 { get; set; }
}

public class ExtractRequest
{
    public long DocumentId { get; set; }
    public List<FormCellValueDto> Cells { get; set; } = new();
    // Fields trực tiếp vào document
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
    public DateTime? Field21 { get; set; }
    public DateTime? Field22 { get; set; }
    public decimal? Field23 { get; set; }
}

public class FormCellValueDto
{
    public long Id { get; set; }
    public string? Value { get; set; }
}

public class PluginSyncParam
{
    public string Token { get; set; } = string.Empty;
    public long Parent { get; set; }
    public string Domain { get; set; } = string.Empty;
    public string UrlSetting { get; set; } = string.Empty;
    public string UrlSave { get; set; } = string.Empty;
    public string UrlStorage { get; set; } = string.Empty;
    public int SyncType { get; set; }
    public int DocTypeId { get; set; }
    public long ContentLengthMax { get; set; }
    public string? Lang { get; set; }
    public bool IsSef { get; set; }
}

public class UploadCallbackRequest
{
    public int ChannelId { get; set; }
    public long FolderId { get; set; }
    public int DocTypeId { get; set; }
    public int CreatedBy { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Extension { get; set; }
    public string? WorkstationName { get; set; }
    public int SyncType { get; set; }
    public string? ExcelMetaJson { get; set; }
}
