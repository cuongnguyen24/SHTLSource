using System.Linq;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>
/// Chuẩn hóa đường dẫn upload web/plugin: bỏ tiền tố gốc scan (giống cấu hình AXE),
/// giữ phần còn lại để parse <see cref="SyncPathFormatParser"/> và lưu file theo cấu trúc thư mục.
/// </summary>
public static class SyncUploadPathNormalizer
{
    /// <summary>Đường dẫn logic (dùng /) sau khi bỏ <paramref name="scanPathRoot"/> nếu khớp tiền tố.</summary>
    public static string ToLogicalRelativePath(string? relativePathFromClient, string? scanPathRoot)
    {
        if (string.IsNullOrWhiteSpace(relativePathFromClient))
            return string.Empty;

        var path = NormalizeSlashes(relativePathFromClient.Trim());
        var root = NormalizeSlashes((scanPathRoot ?? "").Trim());
        if (root.Length == 0)
            return TrimLeadingSlashes(path);

        root = root.TrimEnd('/');

        if (path.StartsWith(root + "/", StringComparison.OrdinalIgnoreCase))
            path = path[(root.Length + 1)..];
        else if (path.Equals(root, StringComparison.OrdinalIgnoreCase))
            path = string.Empty;
        else if (path.Length > root.Length
                 && path.StartsWith(root, StringComparison.OrdinalIgnoreCase)
                 && (path[root.Length] == '/' || path[root.Length] == '\\'))
            path = path[(root.Length + 1)..];

        return TrimLeadingSlashes(path);
    }

    /// <summary>Thư mục con dưới storage root: web-sync/syncTypeId/... các cấp thư mục từ path.</summary>
    public static string BuildStorageSubPath(int syncTypeId, string logicalRelativePath)
    {
        logicalRelativePath = NormalizeSlashes(logicalRelativePath.Trim());
        if (logicalRelativePath.Length == 0)
            return Path.Combine("web-sync", syncTypeId.ToString());

        var dirOnly = Path.GetDirectoryName(logicalRelativePath.Replace('/', Path.DirectorySeparatorChar));
        var parts = new List<string> { "web-sync", syncTypeId.ToString() };
        if (!string.IsNullOrEmpty(dirOnly))
        {
            foreach (var seg in dirOnly.Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar },
                         StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var s = SanitizePathSegment(seg);
                if (s.Length > 0 && s is not ("." or ".."))
                    parts.Add(s);
            }
        }

        return Path.Combine(parts.ToArray());
    }

    private static string NormalizeSlashes(string s)
    {
        var t = s.Replace('\\', '/');
        while (t.Contains("//", StringComparison.Ordinal))
            t = t.Replace("//", "/", StringComparison.Ordinal);
        return t;
    }

    private static string TrimLeadingSlashes(string s)
    {
        while (s.Length > 0 && (s[0] == '/' || s[0] == '\\'))
            s = s[1..];
        return s;
    }

    private static string SanitizePathSegment(string seg)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(seg.Trim().Select(c => invalid.Contains(c) ? '_' : c));
    }
}
