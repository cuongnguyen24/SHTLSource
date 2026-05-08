namespace SHTL.Service.Pdf2Layer;

/// <summary>Cấu hình worker PDF 2 lớp (section <c>SearchablePdf</c>, thống nhất tên với SHTL.App).</summary>
public sealed class SearchablePdfWorkerOptions
{
    public const string SectionName = "SearchablePdf";

    public bool Enabled { get; set; } = true;

    public int PollIntervalSeconds { get; set; } = 5;

    public string PythonExecutable { get; set; } = "python";

    /// <summary>Đường dẫn tương đối tới thư mục chạy service (thư mục chứa .exe).</summary>
    public string ScriptRelativePath { get; set; } = Path.Combine("tools", "searchable-pdf", "generate_searchable_pdf.py");

    public int TimeoutSeconds { get; set; } = 900;

    public int StaleProcessingMinutes { get; set; } = 45;

    public int RenderDpi { get; set; } = 150;
}
