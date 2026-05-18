using System.Diagnostics;
using System.Text;

namespace SHTL.Service.Ocr;

internal static class AppDataFileLog
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string _baseDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "SHTL",
        "OcrService",
        "AppData");

    public static void Configure(string? configuredRootPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredRootPath))
            _baseDir = configuredRootPath.Trim();
    }

    /// <summary>Các thư mục gốc log theo thứ tự ưu tiên (để hiển thị khi khởi động / hỗ trợ).</summary>
    public static IReadOnlyList<string> GetLogRootCandidates()
    {
        var now = DateTime.Now;
        return BuildPathCandidates(now).ToList();
    }

    /// <summary>
    /// Ghi log ra file. Luôn dùng <see cref="CancellationToken.None"/> cho thao tác ghi đĩa
    /// để lỗi không bị nuốt khi token của job bị cancel; tham số <paramref name="cancellationToken"/>
    /// chỉ dùng nếu sau này cần hủy trước khi vào hàng đợi ghi (hiện không dùng).
    /// </summary>
    public static async Task WriteAsync(string level, string message, Exception? ex = null, CancellationToken cancellationToken = default)
    {
        _ = cancellationToken;

        var now = DateTime.Now;
        var sb = new StringBuilder();
        sb.Append('[').Append(now.ToString("yyyy-MM-dd HH:mm:ss.fff")).Append("] ");
        sb.Append('[').Append(level).Append("] ");
        sb.Append(message);
        if (ex is not null)
            sb.AppendLine().Append(ex);
        sb.AppendLine();

        var logLine = sb.ToString();
        await Gate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
        try
        {
            Exception? lastEx = null;
            foreach (var root in BuildPathCandidates(now))
            {
                try
                {
                    var monthDir = Path.Combine(root, now.ToString("yyyy"), now.ToString("MM"));
                    var filePath = Path.Combine(monthDir, $"OcrService-{now:yyyyMMdd}.log");
                    Directory.CreateDirectory(monthDir);
                    await File.AppendAllTextAsync(filePath, logLine, Encoding.UTF8, CancellationToken.None).ConfigureAwait(false);
                    return;
                }
                catch (Exception e)
                {
                    lastEx = e;
                }
            }

            // Mọi đường dẫn chính đều thất bại — ghi fallback + Trace để không mất lỗi
            try
            {
                var fallbackDir = Path.Combine(Path.GetTempPath(), "SHTL", "OcrService", "AppData");
                Directory.CreateDirectory(fallbackDir);
                var fallbackFile = Path.Combine(fallbackDir, $"OcrService-fallback-{now:yyyyMMdd}.log");
                await File.AppendAllTextAsync(fallbackFile, logLine, Encoding.UTF8, CancellationToken.None).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }

            Trace.TraceError(
                "[OcrService] AppDataFileLog: không ghi được vào bất kỳ thư mục nào. Level={0} Message={1} LastError={2}",
                level,
                message,
                lastEx?.Message ?? "(none)");
        }
        finally
        {
            Gate.Release();
        }
    }

    private static IEnumerable<string> BuildPathCandidates(DateTime now)
    {
        _ = now;
        yield return _baseDir;
        yield return Path.Combine(AppContext.BaseDirectory, "AppData");
        yield return Path.Combine(Path.GetTempPath(), "SHTL", "OcrService", "AppData");
    }
}
