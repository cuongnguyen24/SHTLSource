using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Data;
using iText.Kernel.Pdf.Canvas.Parser.Filter;
using iText.Kernel.Pdf.Canvas.Parser.Listener;

namespace SHTL.Modules.Core.Application.Services.Axe;

internal static class PdfOcrRegionTextExtractor
{
    private const float RegionPaddingRatio = 0.03f;

    public static string? Extract(PdfPage page, decimal xRatio, decimal yRatio, decimal widthRatio, decimal heightRatio)
    {
        var segments = PageTextSegmentCollector.Collect(page);
        if (segments.Count > 0)
        {
            var ratioText = NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, yFromTop: true))
                ?? NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, yFromTop: false));
            if (!string.IsNullOrWhiteSpace(ratioText))
                return ratioText;
        }

        foreach (var region in BuildRegionCandidates(page, xRatio, yRatio, widthRatio, heightRatio))
        {
            var text = TryExtractWithRegionFilter(page, region)
                ?? TryExtractWithListener(page, region);
            text = NormalizeExtractedText(text);
            if (!string.IsNullOrWhiteSpace(text))
                return text;
        }

        return null;
    }

    private static string? MatchSegments(
        IReadOnlyList<PageTextSegmentCollector.Segment> segments,
        decimal xRatio,
        decimal yRatio,
        decimal widthRatio,
        decimal heightRatio,
        bool yFromTop)
    {
        var xMin = (float)xRatio - RegionPaddingRatio;
        var xMax = (float)(xRatio + widthRatio) + RegionPaddingRatio;
        var yMin = (float)yRatio - RegionPaddingRatio;
        var yMax = (float)(yRatio + heightRatio) + RegionPaddingRatio;

        var matched = segments
            .Where(s => s.XRatio >= xMin && s.XRatio <= xMax)
            .Where(s =>
            {
                var y = yFromTop ? s.YRatioFromTop : s.YRatioFromBottom;
                return y >= yMin && y <= yMax;
            })
            .OrderByDescending(s => s.BaselineY)
            .ThenBy(s => s.XRatio)
            .Select(s => s.Text)
            .ToList();

        if (matched.Count == 0)
            return null;

        return string.Concat(matched);
    }

    private static IEnumerable<Rectangle> BuildRegionCandidates(
        PdfPage page,
        decimal xRatio,
        decimal yRatio,
        decimal widthRatio,
        decimal heightRatio)
    {
        if (widthRatio <= 0 || heightRatio <= 0)
            yield break;

        var crop = page.GetCropBox();
        var media = page.GetPageSizeWithRotation();
        foreach (var region in new[]
                 {
                     BuildRegion(crop, xRatio, yRatio, widthRatio, heightRatio, yFromTop: true),
                     BuildRegion(crop, xRatio, yRatio, widthRatio, heightRatio, yFromTop: false),
                     BuildRegion(media, xRatio, yRatio, widthRatio, heightRatio, yFromTop: true)
                 })
        {
            if (region is not null)
                yield return region;
        }
    }

    private static Rectangle? BuildRegion(
        Rectangle box,
        decimal xRatio,
        decimal yRatio,
        decimal widthRatio,
        decimal heightRatio,
        bool yFromTop)
    {
        var width = box.GetWidth();
        var height = box.GetHeight();
        if (width <= 0 || height <= 0)
            return null;

        var padX = width * RegionPaddingRatio;
        var padY = height * RegionPaddingRatio;
        var regionWidth = (float)(width * (double)widthRatio) + padX * 2f;
        var regionHeight = (float)(height * (double)heightRatio) + padY * 2f;
        var x = box.GetX() + (float)(width * (double)xRatio) - padX;
        var y = yFromTop
            ? box.GetY() + (float)(height * (1.0 - (double)yRatio - (double)heightRatio)) - padY
            : box.GetY() + (float)(height * (double)yRatio) - padY;

        x = Math.Max(box.GetX(), x);
        y = Math.Max(box.GetY(), y);
        if (x + regionWidth > box.GetX() + width)
            regionWidth = box.GetX() + width - x;
        if (y + regionHeight > box.GetY() + height)
            regionHeight = box.GetY() + height - y;

        return regionWidth <= 0 || regionHeight <= 0 ? null : new Rectangle(x, y, regionWidth, regionHeight);
    }

    private static string? TryExtractWithRegionFilter(PdfPage page, Rectangle region)
    {
        var strategy = new FilteredTextEventListener(
            new LocationTextExtractionStrategy(),
            new TextRegionEventFilter(region));
        return PdfTextExtractor.GetTextFromPage(page, strategy);
    }

    private static string? TryExtractWithListener(PdfPage page, Rectangle region)
    {
        var strategy = new RegionLocationTextExtractionStrategy(region);
        return PdfTextExtractor.GetTextFromPage(page, strategy);
    }

    private static string? NormalizeExtractedText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var normalized = text.Replace('\r', ' ').Replace('\n', ' ').Trim();
        while (normalized.Contains("  ", StringComparison.Ordinal))
            normalized = normalized.Replace("  ", " ", StringComparison.Ordinal);

        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static Rectangle? GetTextBounds(TextRenderInfo renderInfo)
    {
        var ascent = renderInfo.GetAscentLine();
        var descent = renderInfo.GetDescentLine();
        var points = new[]
        {
            ascent.GetStartPoint(),
            ascent.GetEndPoint(),
            descent.GetStartPoint(),
            descent.GetEndPoint()
        };

        var minX = float.MaxValue;
        var minY = float.MaxValue;
        var maxX = float.MinValue;
        var maxY = float.MinValue;
        foreach (var point in points)
        {
            minX = Math.Min(minX, point.Get(Vector.I1));
            minY = Math.Min(minY, point.Get(Vector.I2));
            maxX = Math.Max(maxX, point.Get(Vector.I1));
            maxY = Math.Max(maxY, point.Get(Vector.I2));
        }

        if (minX == float.MaxValue || minY == float.MaxValue)
            return null;

        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    private sealed class PageTextSegmentCollector : IEventListener
    {
        private readonly Rectangle _crop;
        private readonly List<Segment> _segments = new();

        private PageTextSegmentCollector(PdfPage page)
        {
            _crop = page.GetCropBox();
        }

        public static IReadOnlyList<Segment> Collect(PdfPage page)
        {
            var collector = new PageTextSegmentCollector(page);
            var processor = new PdfCanvasProcessor(collector);
            processor.ProcessPageContent(page);
            return collector._segments;
        }

        public void EventOccurred(IEventData data, EventType type)
        {
            if (type != EventType.RENDER_TEXT)
                return;

            var renderInfo = (TextRenderInfo)data;
            var text = renderInfo.GetText();
            if (string.IsNullOrWhiteSpace(text))
                return;

            var bounds = GetTextBounds(renderInfo);
            if (bounds is null)
                return;

            var width = _crop.GetWidth();
            var height = _crop.GetHeight();
            if (width <= 0 || height <= 0)
                return;

            var centerX = bounds.GetX() + bounds.GetWidth() / 2f;
            var centerY = bounds.GetY() + bounds.GetHeight() / 2f;
            var xRatio = (centerX - _crop.GetX()) / width;
            var yFromBottom = (centerY - _crop.GetY()) / height;
            var yFromTop = 1f - yFromBottom;
            var baselineY = renderInfo.GetBaseline().GetStartPoint().Get(Vector.I2);

            _segments.Add(new Segment(
                text,
                xRatio,
                yFromTop,
                yFromBottom,
                baselineY));
        }

        public ICollection<EventType>? GetSupportedEvents() => null;

        internal sealed record Segment(
            string Text,
            float XRatio,
            float YRatioFromTop,
            float YRatioFromBottom,
            float BaselineY);
    }

    private sealed class RegionLocationTextExtractionStrategy : LocationTextExtractionStrategy
    {
        private readonly Rectangle _region;

        public RegionLocationTextExtractionStrategy(Rectangle region)
        {
            _region = region;
        }

        public override void EventOccurred(IEventData data, EventType type)
        {
            if (type != EventType.RENDER_TEXT)
                return;

            var renderInfo = (TextRenderInfo)data;
            if (IntersectsRegion(renderInfo))
                base.EventOccurred(data, type);
        }

        private bool IntersectsRegion(TextRenderInfo renderInfo)
        {
            var bounds = GetTextBounds(renderInfo);
            return bounds is not null && Overlaps(bounds, _region);
        }

        private static bool Overlaps(Rectangle a, Rectangle b)
        {
            var aRight = a.GetX() + a.GetWidth();
            var aTop = a.GetY() + a.GetHeight();
            var bRight = b.GetX() + b.GetWidth();
            var bTop = b.GetY() + b.GetHeight();
            return a.GetX() < bRight && aRight > b.GetX() && a.GetY() < bTop && aTop > b.GetY();
        }
    }
}
