using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Data;
using iText.Kernel.Pdf.Canvas.Parser.Filter;
using iText.Kernel.Pdf.Canvas.Parser.Listener;

namespace SHTL.Modules.Core.Application.Services.Axe;

internal static class PdfOcrRegionTextExtractor
{
    private const float RegionPaddingRatio = 0.006f;
    private const float StrictRegionPaddingRatio = 0.002f;

    public static string? Extract(PdfPage page, decimal xRatio, decimal yRatio, decimal widthRatio, decimal heightRatio)
    {
        var segments = PageTextSegmentCollector.Collect(page, splitCharacters: false);
        if (segments.Count > 0)
        {
            var ratioText = NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, RegionPaddingRatio, yFromTop: true))
                ?? NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, RegionPaddingRatio, yFromTop: false));
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

    public static string? ExtractStrict(PdfPage page, decimal xRatio, decimal yRatio, decimal widthRatio, decimal heightRatio)
    {
        var segments = PageTextSegmentCollector.Collect(page, splitCharacters: true);
        if (segments.Count == 0)
            return null;

        return NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, StrictRegionPaddingRatio, yFromTop: true))
            ?? NormalizeExtractedText(MatchSegments(segments, xRatio, yRatio, widthRatio, heightRatio, StrictRegionPaddingRatio, yFromTop: false));
    }

    private static string? MatchSegments(
        IReadOnlyList<PageTextSegmentCollector.Segment> segments,
        decimal xRatio,
        decimal yRatio,
        decimal widthRatio,
        decimal heightRatio,
        float paddingRatio,
        bool yFromTop)
    {
        var xMin = (float)xRatio - paddingRatio;
        var xMax = (float)(xRatio + widthRatio) + paddingRatio;
        var yMin = (float)yRatio - paddingRatio;
        var yMax = (float)(yRatio + heightRatio) + paddingRatio;

        var matched = segments
            .Where(s => s.XEndRatio >= xMin && s.XStartRatio <= xMax)
            .Where(s =>
            {
                if (yFromTop)
                {
                    var segTopFromTop = 1f - s.YTopRatio;
                    var segBottomFromTop = 1f - s.YBottomRatio;
                    return segBottomFromTop >= yMin && segTopFromTop <= yMax;
                }

                return s.YTopRatio >= yMin && s.YBottomRatio <= yMax;
            })
            .OrderByDescending(s => s.BaselineY)
            .ThenBy(s => s.XRatio)
            .ToList();

        if (matched.Count == 0)
            return null;

        return BuildText(matched);
    }

    private static string BuildText(IReadOnlyList<PageTextSegmentCollector.Segment> matched)
    {
        var lines = matched
            .GroupBy(s => Math.Round(s.BaselineY, 1))
            .OrderByDescending(g => g.Key)
            .Select(g => g.OrderBy(s => s.XRatio).ToList())
            .ToList();

        var output = new List<string>();
        foreach (var line in lines)
        {
            var parts = new List<string>();
            PageTextSegmentCollector.Segment? previous = null;
            foreach (var segment in line)
            {
                if (string.IsNullOrEmpty(segment.Text))
                    continue;

                var gap = previous is null ? 0 : segment.XRatio - previous.XEndRatio;
                if (previous is not null
                    && !string.IsNullOrWhiteSpace(previous.Text)
                    && !string.IsNullOrWhiteSpace(segment.Text)
                    && gap > EstimateSpaceGap(previous, segment))
                {
                    parts.Add(" ");
                }

                parts.Add(segment.Text);
                previous = segment;
            }

            var text = string.Concat(parts).Trim();
            if (!string.IsNullOrWhiteSpace(text))
                output.Add(text);
        }

        return string.Join(" ", output);
    }

    private static float EstimateSpaceGap(PageTextSegmentCollector.Segment previous, PageTextSegmentCollector.Segment current)
    {
        var previousWidth = Math.Max(0.0001f, previous.XEndRatio - previous.XStartRatio);
        var currentWidth = Math.Max(0.0001f, current.XEndRatio - current.XStartRatio);
        var avgCharWidth = Math.Max(0.0001f, (previousWidth + currentWidth) / 2f);
        return Math.Max(0.006f, avgCharWidth * 1.8f);
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
        private readonly bool _splitCharacters;
        private readonly List<Segment> _segments = new();

        private PageTextSegmentCollector(PdfPage page, bool splitCharacters)
        {
            _crop = page.GetCropBox();
            _splitCharacters = splitCharacters;
        }

        public static IReadOnlyList<Segment> Collect(PdfPage page, bool splitCharacters)
        {
            var collector = new PageTextSegmentCollector(page, splitCharacters);
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
            if (string.IsNullOrEmpty(text))
                return;

            if (_splitCharacters)
            {
                foreach (var characterInfo in renderInfo.GetCharacterRenderInfos())
                    AddSegment(characterInfo);
                return;
            }

            AddSegment(renderInfo);
        }

        private void AddSegment(TextRenderInfo renderInfo)
        {
            var text = renderInfo.GetText();
            if (string.IsNullOrEmpty(text))
                return;
            if (!_splitCharacters && string.IsNullOrWhiteSpace(text))
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
            var xStartRatio = (bounds.GetX() - _crop.GetX()) / width;
            var xRatio = (centerX - _crop.GetX()) / width;
            var xEndRatio = (bounds.GetX() + bounds.GetWidth() - _crop.GetX()) / width;
            var yBottomRatio = (bounds.GetY() - _crop.GetY()) / height;
            var yTopRatio = (bounds.GetY() + bounds.GetHeight() - _crop.GetY()) / height;
            var yFromBottom = (centerY - _crop.GetY()) / height;
            var yFromTop = 1f - yFromBottom;
            var baselineY = renderInfo.GetBaseline().GetStartPoint().Get(Vector.I2);

            _segments.Add(new Segment(
                text,
                xStartRatio,
                xRatio,
                xEndRatio,
                yBottomRatio,
                yTopRatio,
                yFromTop,
                yFromBottom,
                baselineY));
        }

        public ICollection<EventType>? GetSupportedEvents() => null;

        internal sealed record Segment(
            string Text,
            float XStartRatio,
            float XRatio,
            float XEndRatio,
            float YBottomRatio,
            float YTopRatio,
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
