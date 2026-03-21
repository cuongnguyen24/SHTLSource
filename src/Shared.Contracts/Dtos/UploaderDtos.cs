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
