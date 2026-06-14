using System.Globalization;
using System.Text.RegularExpressions;
using iText.Kernel.Pdf;
using Microsoft.Extensions.Logging;

namespace SHTL.Service.Ocr;

internal sealed class OcrZoneFieldFillService
{
    private static readonly Regex VietnameseDateRegex = new(
        @"ngày\s*(?<day>\d{1,2})\s*tháng\s*(?<month>\d{1,2})\s*năm\s*(?<year>\d{4})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly OcrServiceJobRepository _repo;
    private readonly ILogger<OcrZoneFieldFillService> _logger;

    public OcrZoneFieldFillService(OcrServiceJobRepository repo, ILogger<OcrZoneFieldFillService> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    public async Task<OcrZoneFillResult> FillFromOcrItemsAsync(
        long documentId,
        int docTypeId,
        IReadOnlyList<OcrTextItem> ocrItems,
        CancellationToken cancellationToken)
    {
        var zones = await _repo.GetOcrZonesAsync(docTypeId, cancellationToken).ConfigureAwait(false);
        if (zones.Count == 0)
            return OcrZoneFillResult.Empty("NO_ZONES");
        if (ocrItems.Count == 0)
            return OcrZoneFillResult.Empty("NO_OCR_ITEMS");

        var existing = await _repo.GetDocumentExistingFieldValuesAsync(documentId, cancellationToken).ConfigureAwait(false);
        var updateValues = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var stats = new OcrZoneFillStats(zones.Count);

        foreach (var zone in zones)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (zone.PageNumber <= 0)
            {
                stats.InvalidPage++;
                continue;
            }

            var key = ResolveTargetColumn(zone.FieldId, zone.FieldName);
            if (string.IsNullOrWhiteSpace(key) || updateValues.ContainsKey(key))
            {
                stats.UnmappedField++;
                continue;
            }
            if (HasExistingValue(existing, key))
            {
                stats.AlreadyHasValue++;
                continue;
            }

            var text = ExtractFromOcrItems(ocrItems, zone);
            if (string.IsNullOrWhiteSpace(text))
            {
                stats.EmptyText++;
                continue;
            }

            var normalized = NormalizeValue(zone.DataType, key, text);
            var typed = ConvertToColumnValue(key, normalized);
            if (typed is null)
            {
                stats.ConvertFailed++;
                continue;
            }

            updateValues[key] = typed;
            stats.Filled++;
        }

        if (updateValues.Count == 0)
            return OcrZoneFillResult.Empty(stats.ToReason());

        await _repo.UpdateDocumentFieldsAsync(documentId, updateValues, cancellationToken).ConfigureAwait(false);
        _logger.LogInformation("Ocr field fill from raw OCR done. DocumentId={DocumentId}, Fields={Count}", documentId, updateValues.Count);
        return OcrZoneFillResult.Ok(updateValues.Count, stats.ToReason() + ";source=raw_ocr");
    }

    public async Task<OcrZoneFillResult> FillAsync(long documentId, int docTypeId, string searchablePdfFullPath, CancellationToken cancellationToken)
    {
        var zones = await _repo.GetOcrZonesAsync(docTypeId, cancellationToken).ConfigureAwait(false);
        if (zones.Count == 0)
            return OcrZoneFillResult.Empty("NO_ZONES");
        if (!File.Exists(searchablePdfFullPath))
            return OcrZoneFillResult.Empty("SEARCHABLE_PDF_MISSING");

        var existing = await _repo.GetDocumentExistingFieldValuesAsync(documentId, cancellationToken).ConfigureAwait(false);
        var updateValues = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var stats = new OcrZoneFillStats(zones.Count);
        using var reader = new PdfReader(searchablePdfFullPath);
        using var pdf = new PdfDocument(reader);

        foreach (var zone in zones)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (zone.PageNumber <= 0 || zone.PageNumber > pdf.GetNumberOfPages())
            {
                stats.InvalidPage++;
                continue;
            }

            var key = ResolveTargetColumn(zone.FieldId, zone.FieldName);
            if (string.IsNullOrWhiteSpace(key) || updateValues.ContainsKey(key))
            {
                stats.UnmappedField++;
                continue;
            }
            if (HasExistingValue(existing, key))
            {
                stats.AlreadyHasValue++;
                continue;
            }

            var text = PdfOcrRegionTextExtractor.Extract(
                pdf.GetPage(zone.PageNumber),
                zone.XRatio,
                zone.YRatio,
                zone.WidthRatio,
                zone.HeightRatio);
            if (string.IsNullOrWhiteSpace(text))
            {
                stats.EmptyText++;
                continue;
            }

            var normalized = NormalizeValue(zone.DataType, key, text);
            var typed = ConvertToColumnValue(key, normalized);
            if (typed is null)
            {
                stats.ConvertFailed++;
                continue;
            }

            updateValues[key] = typed;
            stats.Filled++;
        }

        if (updateValues.Count == 0)
            return OcrZoneFillResult.Empty(stats.ToReason());

        await _repo.UpdateDocumentFieldsAsync(documentId, updateValues, cancellationToken).ConfigureAwait(false);
        _logger.LogInformation("Ocr field fill done. DocumentId={DocumentId}, Fields={Count}", documentId, updateValues.Count);
        return OcrZoneFillResult.Ok(updateValues.Count, stats.ToReason());
    }

    private static bool HasExistingValue(IReadOnlyDictionary<string, object?> values, string key)
    {
        if (!values.TryGetValue(key, out var value) || value is null)
            return false;
        if (value is string s)
            return !string.IsNullOrWhiteSpace(s) && !LooksGarbled(s);
        return true;
    }

    private static bool LooksGarbled(string value)
        => value.Contains('\uFFFD', StringComparison.Ordinal);

    private static string? ExtractFromOcrItems(IReadOnlyList<OcrTextItem> items, OcrZoneRow zone)
    {
        const float padding = 0.02f;
        var xMin = (float)zone.XRatio - padding;
        var xMax = (float)(zone.XRatio + zone.WidthRatio) + padding;
        var yMin = (float)zone.YRatio - padding;
        var yMax = (float)(zone.YRatio + zone.HeightRatio) + padding;

        var matched = items
            .Where(x => x.PageNumber == zone.PageNumber)
            .Where(x => !string.IsNullOrWhiteSpace(x.Text))
            .Where(x => x.XEndRatio >= xMin && x.XStartRatio <= xMax)
            .Where(x => x.YBottomRatio >= yMin && x.YTopRatio <= yMax)
            .OrderBy(x => x.YTopRatio)
            .ThenBy(x => x.XStartRatio)
            .ToList();

        if (matched.Count == 0)
            return null;

        var lines = new List<List<OcrTextItem>>();
        foreach (var item in matched)
        {
            var line = lines.LastOrDefault();
            if (line is null || Math.Abs(line[0].YTopRatio - item.YTopRatio) > 0.018f)
                lines.Add(new List<OcrTextItem> { item });
            else
                line.Add(item);
        }

        var output = new List<string>();
        foreach (var line in lines)
        {
            var ordered = line.OrderBy(x => x.XStartRatio).ToList();
            var parts = new List<string>();
            OcrTextItem? previous = null;
            foreach (var item in ordered)
            {
                var text = item.Text.Trim();
                if (text.Length == 0)
                    continue;

                if (previous is not null)
                {
                    var gap = item.XStartRatio - previous.XEndRatio;
                    if (gap > 0.006f && !text.StartsWith(",", StringComparison.Ordinal) && !text.StartsWith(".", StringComparison.Ordinal))
                        parts.Add(" ");
                }

                parts.Add(text);
                previous = item;
            }

            var lineText = string.Concat(parts).Trim();
            if (!string.IsNullOrWhiteSpace(lineText))
                output.Add(lineText);
        }

        return NormalizeExtractedText(string.Join(" ", output));
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

    private static string ResolveTargetColumn(int fieldId, string? fieldName)
    {
        if (fieldId > 0)
        {
            var byId = ResolveByFieldId(fieldId);
            if (!string.IsNullOrWhiteSpace(byId))
                return byId;
        }

        if (string.IsNullOrWhiteSpace(fieldName))
            return string.Empty;

        var key = fieldName.Trim().ToLowerInvariant();
        return key switch
        {
            "dc_title" or "title" or "name" => "name",
            "dc_symbol" or "symbolno" or "symbol_no" => "symbol_no",
            "dc_record" or "recordno" or "record_no" => "record_no",
            "dc_issued_by" or "issuer" or "issuedby" or "issued_by" => "issued_by",
            "receiver" or "dc_receiver" => "receiver",
            "subject" => "subject",
            "levelno" or "dc_box" => "level_no",
            "boxno" or "dc_num1" => "box_no",
            "recordtitle" or "dc_custom1" or "fc_title" => "record_title",
            "poster" => "poster",
            "signer" => "signer",
            "slotno" or "dc_select1" => "slot_no",
            "shelfno" or "fc_lang" => "shelf_no",
            "author" or "dc_author" => "author",
            "noted" or "dc_noted" => "noted",
            "summary" => "summary",
            "describe" => "describe",
            _ when key.StartsWith("field", StringComparison.OrdinalIgnoreCase) => key,
            _ => string.Empty
        };
    }

    private static string ResolveByFieldId(int fieldId)
    {
        return fieldId switch
        {
            1 => "name",
            2 => "symbol_no",
            3 => "issued_by",
            4 => "receiver",
            5 => "subject",
            6 => "level_no",
            7 => "box_no",
            8 => "record_no",
            9 => "record_title",
            10 => "poster",
            11 => "signer",
            12 => "slot_no",
            13 => "shelf_no",
            14 => "noted",
            15 => "field23",
            16 => "field22",
            17 => "field15",
            18 => "field16",
            19 => "field23",
            20 => "field21",
            >= 101 and <= 125 => $"field{fieldId - 100}",
            _ => string.Empty
        };
    }

    private static string NormalizeValue(string? dataType, string key, string raw)
    {
        var text = raw.Trim();
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var isDate = string.Equals(dataType, "date", StringComparison.OrdinalIgnoreCase)
            || string.Equals(dataType, "datetime", StringComparison.OrdinalIgnoreCase)
            || key is "field21" or "field22";
        if (!isDate)
            return text;

        var match = VietnameseDateRegex.Match(text);
        if (!match.Success)
            return text;

        var day = int.Parse(match.Groups["day"].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(match.Groups["month"].Value, CultureInfo.InvariantCulture);
        var year = int.Parse(match.Groups["year"].Value, CultureInfo.InvariantCulture);
        return new DateTime(year, month, day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static object? ConvertToColumnValue(string column, string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (column is "field16" or "field17" or "field18" or "field19" or "field20")
            return long.TryParse(value, out var l) ? l : null;
        if (column is "field21" or "field22")
            return DateTime.TryParse(value, out var d) ? d : null;
        if (column is "field23" or "field24" or "field25")
            return decimal.TryParse(value, out var m) ? m : null;

        return value;
    }

    private sealed class OcrZoneFillStats
    {
        public OcrZoneFillStats(int totalZones) => TotalZones = totalZones;
        public int TotalZones { get; }
        public int Filled { get; set; }
        public int InvalidPage { get; set; }
        public int UnmappedField { get; set; }
        public int AlreadyHasValue { get; set; }
        public int EmptyText { get; set; }
        public int ConvertFailed { get; set; }

        public string ToReason()
            => $"zones={TotalZones};filled={Filled};invalidPage={InvalidPage};unmapped={UnmappedField};alreadyHasValue={AlreadyHasValue};emptyText={EmptyText};convertFailed={ConvertFailed}";
    }
}

internal sealed record OcrZoneFillResult(bool Success, int FilledCount, string Reason)
{
    public static OcrZoneFillResult Ok(int filledCount, string reason) => new(true, filledCount, reason);
    public static OcrZoneFillResult Empty(string reason) => new(false, 0, reason);
}
