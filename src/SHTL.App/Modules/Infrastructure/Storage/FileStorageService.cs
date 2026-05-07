using System.Linq;
using SHTL.Modules.Core.Domain.Contracts;
using Microsoft.Extensions.Options;

namespace SHTL.Modules.Infrastructure.Storage;

public class StorageOptions
{
    public string RootPath { get; set; } = string.Empty;
    public string VirtualPath { get; set; } = "/files";
    public string ThumbnailPath { get; set; } = string.Empty;
    public long MaxFileSizeBytes { get; set; } = 100 * 1024 * 1024; // 100MB
    public string[] AllowedExtensions { get; set; } = { ".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png" };
}

public class LocalFileStorageService : IStorageService
{
    private readonly StorageOptions _options;

    public LocalFileStorageService(IOptions<StorageOptions> opts)
    {
        _options = opts.Value;
    }

    public async Task<string> SaveFileAsync(Stream stream, string fileName, string subPath)
    {
        var safeSub = SanitizeRelativeSubPath(subPath);
        var fullDir = Path.Combine(_options.RootPath, safeSub);
        Directory.CreateDirectory(fullDir);

        var safeFileName = SanitizeFileName(fileName);
        var fullPath = Path.Combine(fullDir, safeFileName);

        // Avoid overwrite
        if (File.Exists(fullPath))
        {
            var ext = Path.GetExtension(safeFileName);
            var name = Path.GetFileNameWithoutExtension(safeFileName);
            safeFileName = $"{name}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
            fullPath = Path.Combine(fullDir, safeFileName);
        }

        await using var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await stream.CopyToAsync(fs);

        return Path.Combine(safeSub, safeFileName).Replace('\\', '/');
    }

    /// <summary>Bỏ segment rỗng, "..", ký tự không hợp lệ trong từng phần của đường dẫn con.</summary>
    private static string SanitizeRelativeSubPath(string subPath)
    {
        if (string.IsNullOrWhiteSpace(subPath))
            return string.Empty;
        var parts = subPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(SanitizeFileName)
            .Where(p => p.Length > 0 && p is not ("." or ".."));
        return string.Join(Path.DirectorySeparatorChar, parts);
    }

    public async Task<Stream?> GetFileAsync(string path)
    {
        var fullPath = ResolveSafeFullPath(path);
        if (fullPath is null || !File.Exists(fullPath)) return null;

        var ms = new MemoryStream();
        await using var fs = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        await fs.CopyToAsync(ms);
        ms.Position = 0;
        return ms;
    }

    public Stream? OpenRead(string relativePath)
    {
        var fullPath = ResolveSafeFullPath(relativePath);
        if (fullPath is null || !File.Exists(fullPath)) return null;
        return new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
    }

    public Task<bool> DeleteFileAsync(string path)
    {
        var fullPath = ResolveSafeFullPath(path);
        if (fullPath is null || !File.Exists(fullPath)) return Task.FromResult(false);
        File.Delete(fullPath);
        return Task.FromResult(true);
    }

    public Task<string> GetPublicUrlAsync(string path)
    {
        var url = _options.VirtualPath.TrimEnd('/') + "/" + path.TrimStart('/');
        return Task.FromResult(url);
    }

    public async Task<string?> SaveThumbnailAsync(string sourcePath, string thumbSubPath)
    {
        // Placeholder - thumbnail generation sẽ implement bằng ImageSharp
        await Task.CompletedTask;
        return null;
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var safe = string.Concat(fileName.Select(c => invalid.Contains(c) ? '_' : c));
        return safe;
    }

    /// <summary>Chuẩn hóa path và chặn path traversal.</summary>
    private string? ResolveSafeFullPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var root = Path.GetFullPath(_options.RootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var combined = Path.GetFullPath(Path.Combine(root, path.TrimStart('/', '\\')));
        var rootPrefix = root + Path.DirectorySeparatorChar;
        var ok = combined.Equals(root, StringComparison.OrdinalIgnoreCase)
                 || combined.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase);
        if (!ok) return null;
        return combined;
    }
}
