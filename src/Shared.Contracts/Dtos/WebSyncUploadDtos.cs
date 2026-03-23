namespace Shared.Contracts.Dtos;

public sealed class WebSyncUploadItemResult
{
    public string FileName { get; init; } = string.Empty;
    public string RelativePath { get; init; } = string.Empty;
    public bool Success { get; init; }
    public string? Message { get; init; }
    public long? DocumentId { get; init; }
}

public sealed class WebSyncUploadBatchResult
{
    public IReadOnlyList<WebSyncUploadItemResult> Items { get; init; } = Array.Empty<WebSyncUploadItemResult>();
    public int SuccessCount => Items.Count(x => x.Success);
    public int FailCount => Items.Count(x => !x.Success);
}
