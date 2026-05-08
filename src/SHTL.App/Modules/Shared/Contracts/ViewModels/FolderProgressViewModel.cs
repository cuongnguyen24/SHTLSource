namespace SHTL.Modules.Shared.Contracts.ViewModels;

public sealed class FolderProgressViewModel
{
    public string Filter { get; set; } = string.Empty;
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
    public SearchablePdfServiceStatusViewModel ServiceStatus { get; set; } = new();
    public IReadOnlyList<FolderProgressRowViewModel> Rows { get; set; } = Array.Empty<FolderProgressRowViewModel>();
}

public sealed class SearchablePdfServiceStatusViewModel
{
    public int Queued { get; set; }
    public int Processing { get; set; }
    public int Ready { get; set; }
    public int Failed { get; set; }
    public DateTime? LastActivityAtUtc { get; set; }
    public DateTime? LastProcessingAtUtc { get; set; }
    public string StatusText { get; set; } = "Chưa xác định";
    public IReadOnlyList<SearchablePdfCurrentDocViewModel> CurrentProcessingDocs { get; set; } = Array.Empty<SearchablePdfCurrentDocViewModel>();
}

public sealed class SearchablePdfCurrentDocViewModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class FolderProgressRowViewModel
{
    public string Folder { get; set; } = string.Empty;
    public int TotalDocs { get; set; }
    public int TotalPdfs { get; set; }
    public int PdfQueued { get; set; }
    public int PdfProcessing { get; set; }
    public int PdfReady { get; set; }
    public int PdfFailed { get; set; }
    public int ExtractedDone { get; set; }
    public int Check1Done { get; set; }
    public int Check2Done { get; set; }
}
