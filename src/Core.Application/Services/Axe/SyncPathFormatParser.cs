namespace Core.Application.Services.Axe;

/// <summary>
/// Port <c>SohoaCusUtility.GetDataByFormat</c> (AXE): format dạng <c>{nam}/{thang}/{so}</c>,
/// đường dẫn tương đối (vd. từ webkitdirectory) tách theo segment; mỗi phần trong format có <c>{key}</c> nhận segment tương ứng.
/// </summary>
public static class SyncPathFormatParser
{
    public static Dictionary<string, string?> Parse(string? format, string? relativePath)
    {
        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(format) || string.IsNullOrWhiteSpace(relativePath))
            return data;

        var segments = SplitPathSegments(relativePath);
        var formatParts = format.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        for (var i = 0; i < formatParts.Length && i < segments.Count; i++)
        {
            var form = formatParts[i].Trim();
            if (form.Length < 3 || form[0] != '{' || form[^1] != '}')
                continue;
            var key = form[1..^1].Trim();
            if (key.Length == 0)
                continue;
            data[key] = segments[i];
        }

        return data;
    }

    /// <summary>Gán các thư mục cha vào field1..field15 (tương đương Field85+ trong AXE, thu gọn).</summary>
    public static void ApplyFolderSegmentsToFields(Core.Domain.Entities.Stg.Document doc, string? relativePath, int maxDepth = 15)
    {
        var s = relativePath?.Trim().Replace('\\', '/') ?? "";
        var lastSlash = s.LastIndexOf('/');
        var dir = lastSlash <= 0 ? "" : s[..lastSlash];
        if (string.IsNullOrEmpty(dir))
            return;
        var parts = SplitPathSegments(dir);
        var n = Math.Min(maxDepth, parts.Count);
        for (var i = 0; i < n; i++)
            SetFieldBySlot(doc, i, parts[i]);
    }

    private static void SetFieldBySlot(Core.Domain.Entities.Stg.Document doc, int index, string value)
    {
        switch (index)
        {
            case 0: doc.Field1 = value; break;
            case 1: doc.Field2 = value; break;
            case 2: doc.Field3 = value; break;
            case 3: doc.Field4 = value; break;
            case 4: doc.Field5 = value; break;
            case 5: doc.Field6 = value; break;
            case 6: doc.Field7 = value; break;
            case 7: doc.Field8 = value; break;
            case 8: doc.Field9 = value; break;
            case 9: doc.Field10 = value; break;
            case 10: doc.Field11 = value; break;
            case 11: doc.Field12 = value; break;
            case 12: doc.Field13 = value; break;
            case 13: doc.Field14 = value; break;
            case 14: doc.Field15 = value; break;
        }
    }

    private static List<string> SplitPathSegments(string relativePath)
    {
        var s = relativePath.Trim().Replace('\\', '/');
        while (s.Contains("//", StringComparison.Ordinal))
            s = s.Replace("//", "/", StringComparison.Ordinal);
        return s.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Uri.UnescapeDataString(x))
            .ToList();
    }
}
