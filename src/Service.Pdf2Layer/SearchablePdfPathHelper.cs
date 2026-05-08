namespace SHTL.Service.Pdf2Layer;

internal static class SearchablePdfPathHelper
{
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
