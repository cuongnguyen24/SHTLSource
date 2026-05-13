using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Infrastructure.Storage;

namespace SHTL.Modules.Core.Application.Services.Axe;

internal static class StoragePdfFileReader
{
    public static async Task<byte[]?> ReadAllBytesAsync(
        IStorageService storage,
        StorageOptions options,
        IEnumerable<string> candidates,
        CancellationToken cancellationToken = default)
    {
        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
                continue;

            await using var stream = OpenRead(storage, options, candidate.Trim());
            if (stream is null)
                continue;

            await using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, cancellationToken);
            if (buffer.Length > 0)
                return buffer.ToArray();
        }

        return null;
    }

    public static Stream? OpenRead(IStorageService storage, StorageOptions options, string path)
    {
        var stream = storage.OpenRead(path);
        if (stream is not null)
            return stream;

        if (Path.IsPathRooted(path) && File.Exists(path))
            return new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);

        var cleanRel = path.TrimStart('/', '\\')
            .Replace('/', Path.DirectorySeparatorChar)
            .Replace('\\', Path.DirectorySeparatorChar);

        foreach (var root in EnumerateRoots(options))
        {
            try
            {
                var baseRoot = Path.GetFullPath(root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                var full = Path.GetFullPath(Path.Combine(baseRoot, cleanRel));
                if (!full.StartsWith(baseRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(full, baseRoot, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!File.Exists(full))
                    continue;

                return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read);
            }
            catch
            {
                // try next root
            }
        }

        return null;
    }

    private static IEnumerable<string> EnumerateRoots(StorageOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.RootPath))
            yield return options.RootPath;

        yield return @"E:\SHTL\Files";
        yield return @"E:\SHTL\Storage\Files";
    }
}
