using Microsoft.Extensions.Options;

namespace SHTL.Service.Ocr;

internal sealed class WorkerFileStorage
{
    private readonly StorageOptions _options;

    public WorkerFileStorage(IOptions<StorageOptions> options)
    {
        _options = options.Value;
    }

    public async Task<string> SaveFileAsync(Stream stream, string fileName, string subPath, CancellationToken cancellationToken = default)
    {
        var safeSub = SanitizeRelativeSubPath(subPath);
        var fullDir = Path.Combine(_options.RootPath, safeSub);
        Directory.CreateDirectory(fullDir);

        var safeFileName = SanitizeFileName(fileName);
        var fullPath = Path.Combine(fullDir, safeFileName);

        if (File.Exists(fullPath))
        {
            var ext = Path.GetExtension(safeFileName);
            var name = Path.GetFileNameWithoutExtension(safeFileName);
            safeFileName = $"{name}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
            fullPath = Path.Combine(fullDir, safeFileName);
        }

        await using var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await stream.CopyToAsync(fs, cancellationToken).ConfigureAwait(false);

        return Path.Combine(safeSub, safeFileName).Replace('\\', '/');
    }

    private static string SanitizeRelativeSubPath(string subPath)
    {
        if (string.IsNullOrWhiteSpace(subPath))
            return string.Empty;
        var parts = subPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(SanitizeFileName)
            .Where(p => p.Length > 0 && p is not ("." or ".."));
        return string.Join(Path.DirectorySeparatorChar, parts);
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(fileName.Select(c => invalid.Contains(c) ? '_' : c));
    }
}
