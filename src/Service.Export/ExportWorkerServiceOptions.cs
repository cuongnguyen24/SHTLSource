namespace SHTL.Service.Export;

public sealed class ExportWorkerServiceOptions
{
    public const string SectionName = "ExportWorker";

    public int PollIntervalSeconds { get; set; } = 5;
    public int BatchSize { get; set; } = 5;
    public bool Enabled { get; set; } = true;
}
