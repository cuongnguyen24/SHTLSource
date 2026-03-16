using Core.Domain.Contracts;
using Microsoft.Extensions.Options;

namespace Infrastructure.Storage;

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
        var fullDir = Path.Combine(_options.RootPath, subPath);
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

        return Path.Combine(subPath, safeFileName).Replace('\\', '/');
    }

    public async Task<Stream?> GetFileAsync(string path)
    {
        var fullPath = Path.Combine(_options.RootPath, path.TrimStart('/'));
        if (!File.Exists(fullPath)) return null;

        var ms = new MemoryStream();
        await using var fs = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        await fs.CopyToAsync(ms);
        ms.Position = 0;
        return ms;
    }

    public Task<bool> DeleteFileAsync(string path)
    {
        var fullPath = Path.Combine(_options.RootPath, path.TrimStart('/'));
        if (!File.Exists(fullPath)) return Task.FromResult(false);
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
}
