using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Shared.Contracts;

/// <summary>Nhãn hiển thị trạng thái PDF 2 lớp (OCR lớp chữ).</summary>
public static class SearchablePdfDisplay
{
    public static string StatusLabel(OcrStatus status) => status switch
    {
        OcrStatus.SearchablePdfQueued => "Chờ PDF 2 lớp",
        OcrStatus.SearchablePdfProcessing => "Đang tạo PDF 2 lớp",
        OcrStatus.SearchablePdfReady => "Đã có PDF 2 lớp",
        OcrStatus.SearchablePdfFailed => "Lỗi PDF 2 lớp",
        _ => ""
    };

    public static bool IsSearchablePdfRelevant(OcrStatus status) =>
        status is OcrStatus.SearchablePdfQueued
            or OcrStatus.SearchablePdfProcessing
            or OcrStatus.SearchablePdfReady
            or OcrStatus.SearchablePdfFailed;

    public static bool LooksLikePdf(string? extension, string? fileName, string? filePath)
    {
        var ext = (extension ?? "").Trim().TrimStart('.').ToLowerInvariant();
        if (ext == "pdf") return true;
        if (!string.IsNullOrEmpty(fileName) && fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.IsNullOrEmpty(filePath) && filePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }
}
