using System.ComponentModel.DataAnnotations;

namespace Shared.Contracts.Dtos;

public class UploadFileResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Extension { get; set; }
    public string? PublicUrl { get; set; }
}

public class UploadFileRequest
{
    [Required] public int ChannelId { get; set; }
    public long FolderId { get; set; }
    public int DocTypeId { get; set; }
    public int CreatedBy { get; set; }
    public int SyncType { get; set; }
    public string? WorkstationName { get; set; }
}

// ---------- Resumable upload (chunk) ----------
public class ResumableInitRequest
{
    [Required] public int ChannelId { get; set; }
    [Required] public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? FileId { get; set; } // optional from client; if null -> server creates
}

public class ResumableInitResponse
{
    public bool Success { get; set; }
    public string FileId { get; set; } = string.Empty;
    public string? Message { get; set; }
}

public class ResumableCompleteRequest
{
    [Required] public int ChannelId { get; set; }
    [Required] public string FileId { get; set; } = string.Empty;
    [Required] public string FileName { get; set; } = string.Empty;
    public int TotalChunks { get; set; }
    public long FileSize { get; set; }
}

public class ResumableCompleteResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string StoredPath { get; set; } = string.Empty;
    public string? PublicUrl { get; set; }
    public long FileSize { get; set; }
}
