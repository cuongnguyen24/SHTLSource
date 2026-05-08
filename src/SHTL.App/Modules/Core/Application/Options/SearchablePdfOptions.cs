namespace SHTL.Modules.Core.Application.Options;

/// <summary>Cấu hình tạo PDF 2 lớp (OCR tiếng Việt qua script Python + VNCV).</summary>
public sealed class SearchablePdfOptions
{
    public const string SectionName = "SearchablePdf";

    /// <summary>Bật worker xử lý hàng đợi PDF 2 lớp.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Khi <c>false</c>, không đăng ký <see cref="SHTL.Modules.Core.Application.Services.SearchablePdfHostedService"/> trong tiến trình web —
    /// dùng Windows Service riêng (ví dụ <c>Service.Pdf2Layer</c>) cùng DB và <c>Storage:RootPath</c>.
    /// </summary>
    public bool RunWorkerInWebProcess { get; set; } = true;

    /// <summary>Thời gian nghỉ giữa các lần kiểm tra hàng đợi (giây).</summary>
    public int PollIntervalSeconds { get; set; } = 5;

    /// <summary>Executable Python, ví dụ <c>python</c> hoặc đường dẫn đầy đủ.</summary>
    public string PythonExecutable { get; set; } = "python";

    /// <summary>Đường dẫn script tính từ thư mục chạy ứng dụng (ContentRoot).</summary>
    public string ScriptRelativePath { get; set; } = Path.Combine("tools", "searchable-pdf", "generate_searchable_pdf.py");

    public int TimeoutSeconds { get; set; } = 900;

    /// <summary>Sau khoảng thời gian này, trạng thái <see cref="Enums.OcrStatus.SearchablePdfProcessing"/> bị đưa lại về hàng chờ.</summary>
    public int StaleProcessingMinutes { get; set; } = 45;

    /// <summary>DPI khi raster hóa từng trang PDF trước khi OCR (truyền cho script).</summary>
    public int RenderDpi { get; set; } = 150;
}
