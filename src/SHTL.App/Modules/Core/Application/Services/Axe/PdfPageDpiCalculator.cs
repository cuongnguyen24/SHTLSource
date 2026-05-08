using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Data;
using iText.Kernel.Pdf.Canvas.Parser.Listener;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>
/// Port từ AXE SohoaCusUtility.ImageRenderListener.
/// Tính DPI từng trang PDF bằng cách parse image từ PDF stream.
/// </summary>
public sealed class PdfPageDpiCalculator
{
    public sealed class PageDpiInfo
    {
        public int PageNumber { get; init; }
        public int DpiX { get; init; }
        public int DpiY { get; init; }
        public string? PageSize { get; init; }
    }

    /// <summary>
    /// Tính DPI cho tất cả các trang trong PDF.
    /// Trả về list (PageNumber, DpiX, DpiY).
    /// </summary>
    public static List<PageDpiInfo> CalculateAllPages(string pdfPath)
    {
        var results = new List<PageDpiInfo>();
        using var pdfDoc = new PdfDocument(new PdfReader(pdfPath));
        var pageCount = pdfDoc.GetNumberOfPages();

        for (int i = 1; i <= pageCount; i++)
        {
            var page = pdfDoc.GetPage(i);
            var strategy = new ImageRenderListenerInternal();
            var processor = new PdfCanvasProcessor(strategy);
            processor.ProcessPageContent(page);

            var dpiX = 0;
            var dpiY = 0;
            if (strategy.Images.Count > 0)
            {
                // Lấy DPI trung bình hoặc max của tất cả image trong trang
                dpiX = (int)Math.Round(strategy.Images.Max(x => x.DpiX));
                dpiY = (int)Math.Round(strategy.Images.Max(x => x.DpiY));
            }

            // Tính page size (port logic từ AXE SoHoaUtility.GetSizePDF nếu cần)
            var cropbox = page.GetCropBox();
            var width = cropbox.GetWidth();
            var height = cropbox.GetHeight();
            var pageSize = GetPageSize(width, height);

            results.Add(new PageDpiInfo
            {
                PageNumber = i,
                DpiX = dpiX,
                DpiY = dpiY,
                PageSize = pageSize
            });
        }

        return results;
    }

    /// <summary>
    /// Port từ AXE ImageRenderListener (iText7).
    /// Listener để parse image từ PDF stream và tính DPI.
    /// </summary>
    private sealed class ImageRenderListenerInternal : IEventListener
    {
        public List<(float DpiX, float DpiY)> Images { get; } = new();

        public void EventOccurred(IEventData data, EventType type)
        {
            if (type == EventType.RENDER_IMAGE)
            {
                var renderInfo = (ImageRenderInfo)data;
                var image = renderInfo.GetImage();
                var widthPx = image.GetWidth();
                var heightPx = image.GetHeight();

                var matrix = renderInfo.GetImageCtm();
                // PDF đơn vị là points (1 inch = 72pt)
                var widthInch = matrix.Get(iText.Kernel.Geom.Matrix.I11) / 72f;
                var heightInch = matrix.Get(iText.Kernel.Geom.Matrix.I22) / 72f;

                if (widthInch > 0 && heightInch > 0)
                {
                    float dpiX = widthPx / widthInch;
                    float dpiY = heightPx / heightInch;
                    Images.Add((dpiX, dpiY));
                }
            }
        }

        public ICollection<EventType>? GetSupportedEvents() => null;
    }

    /// <summary>
    /// Xác định page size (A0-A5, Other) dựa trên width/height (points).
    /// Port đơn giản từ AXE SoHoaUtility.GetSizePDF.
    /// </summary>
    private static string GetPageSize(float widthPt, float heightPt)
    {
        // Chuyển points sang mm (1pt = 0.352778mm)
        var widthMm = widthPt * 0.352778f;
        var heightMm = heightPt * 0.352778f;

        // A4: 210x297mm, A3: 297x420mm, ...
        // Đơn giản: so sánh với kích thước chuẩn ± 10mm
        if (IsNear(widthMm, 210) && IsNear(heightMm, 297)) return "A4";
        if (IsNear(widthMm, 297) && IsNear(heightMm, 420)) return "A3";
        if (IsNear(widthMm, 420) && IsNear(heightMm, 594)) return "A2";
        if (IsNear(widthMm, 594) && IsNear(heightMm, 841)) return "A1";
        if (IsNear(widthMm, 841) && IsNear(heightMm, 1189)) return "A0";
        if (IsNear(widthMm, 148) && IsNear(heightMm, 210)) return "A5";

        return "Other";
    }

    private static bool IsNear(float actual, float expected, float tolerance = 10f)
        => Math.Abs(actual - expected) <= tolerance || Math.Abs(actual - expected) <= tolerance;
}
