using System.Text;

namespace SHTL.Service.Pdf2Layer;

internal static class AppDataFileLog
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string _baseDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "SHTL",
        "Pdf2Layer",
        "AppData");

    public static void Configure(string? configuredRootPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredRootPath))
            _baseDir = configuredRootPath.Trim();
    }

    public static async Task WriteAsync(string level, string message, Exception? ex = null, CancellationToken cancellationToken = default)
    {
        var now = DateTime.Now;
        var sb = new StringBuilder();
        sb.Append('[').Append(now.ToString("yyyy-MM-dd HH:mm:ss.fff")).Append("] ");
        sb.Append('[').Append(level).Append("] ");
        sb.Append(message);
        if (ex is not null)
            sb.AppendLine().Append(ex);
        sb.AppendLine();

        await Gate.WaitAsync().ConfigureAwait(false);
        try
        {
            var logLine = sb.ToString();
            var candidates = BuildPathCandidates(now);
            foreach (var root in candidates)
            {
                try
                {
                    var monthDir = Path.Combine(root, now.ToString("yyyy"), now.ToString("MM"));
                    var filePath = Path.Combine(monthDir, $"pdf2layer-{now:yyyyMMdd}.log");
                    Directory.CreateDirectory(monthDir);
                    await File.AppendAllTextAsync(filePath, logLine, Encoding.UTF8, cancellationToken).ConfigureAwait(false);
                    return;
                }
                catch
                {
                    // try next candidate path
                }
            }
        }
        finally
        {
            Gate.Release();
        }
    }

    private static IEnumerable<string> BuildPathCandidates(DateTime now)
    {
        yield return _baseDir;
        yield return Path.Combine(AppContext.BaseDirectory, "AppData");
        yield return Path.Combine(Path.GetTempPath(), "SHTL", "Pdf2Layer", "AppData");
    }
}
