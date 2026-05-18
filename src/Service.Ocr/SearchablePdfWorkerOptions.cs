namespace SHTL.Service.Ocr;

/// <summary>Cấu hình worker PDF 2 lớp (section <c>OcrSearchablePdf</c>, thống nhất tên với SHTL.App).</summary>
public sealed class OcrSearchablePdfWorkerOptions
{
    public const string SectionName = "OcrSearchablePdf";

    public bool Enabled { get; set; } = true;

    public int PollIntervalSeconds { get; set; } = 5;

    public string PythonExecutable { get; set; } = "python";

    /// <summary>Đường dẫn tương đối tới thư mục chạy service (thư mục chứa .exe).</summary>
    public string ScriptRelativePath { get; set; } = Path.Combine("tools", "ocr-service", "generate_searchable_pdf.py");

    /// <summary>Tự cài package Python khi thiếu (không cần chạy lệnh tay sau khi publish).</summary>
    public bool AutoInstallPythonDependencies { get; set; } = true;

    /// <summary>
    /// Tự tải Python embeddable zip vào thư mục <c>python/</c> nếu máy chưa có Python runtime.
    /// </summary>
    public bool AutoProvisionEmbeddedPython { get; set; } = true;

    /// <summary>Version Python embeddable mặc định (Windows x64).</summary>
    public string EmbeddedPythonVersion { get; set; } = "3.12.10";

    /// <summary>
    /// URL tải Python embeddable zip. Nếu để trống, service tự sinh theo version.
    /// </summary>
    public string? EmbeddedPythonDownloadUrl { get; set; }

    /// <summary>
    /// URL script get-pip.py để bootstrap pip cho Python embeddable.
    /// </summary>
    public string GetPipUrl { get; set; } = "https://bootstrap.pypa.io/get-pip.py";

    /// <summary>File requirements tương đối so với thư mục chạy service.</summary>
    public string RequirementsRelativePath { get; set; } = Path.Combine("tools", "ocr-service", "requirements.txt");

    /// <summary>Thư mục wheel offline (tùy chọn). Nếu có sẽ dùng --no-index --find-links.</summary>
    public string? OfflineWheelhouseRelativePath { get; set; }

    /// <summary>
    /// Giới hạn số trang OCR cho mỗi tài liệu. 0 hoặc âm = chạy toàn bộ.
    /// Giá trị này sẽ bị ghi đè bởi cấu hình Admin/Config key: NumberOfPagesRunInOcrService (nếu có).
    /// </summary>
    public int NumberOfPagesRunInOcrService { get; set; } = 0;

    /// <summary>
    /// Đường dẫn root log file (tùy chọn). Nếu rỗng, service sẽ dùng ProgramData\SHTL\OcrService\AppData.
    /// </summary>
    public string? LogRootPath { get; set; }

    public int TimeoutSeconds { get; set; } = 900;

    public int StaleProcessingMinutes { get; set; } = 45;

    // ── Dynamic concurrency ───────────────────────────────────────────────────

    /// <summary>
    /// Số worker (Python process) chạy song song tối đa.
    /// <c>0</c> (mặc định) = tự động scale theo RAM và số CPU core.
    /// Đặt giá trị dương để cố định (bỏ qua auto-scale).
    /// </summary>
    public int MaxConcurrentWorkers { get; set; } = 5;

    /// <summary>
    /// RAM tối thiểu cần còn trống (MB) để khởi động thêm 1 Python worker.
    /// Auto-scale sẽ không tăng thêm worker nếu RAM khả dụng &lt; giá trị này.
    /// Mặc định 400 MB. Đặt 0 để tắt kiểm tra RAM.
    /// </summary>
    public int MinFreeMemoryPerJobMb { get; set; } = 400;
}
