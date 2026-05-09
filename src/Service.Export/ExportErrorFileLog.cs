using System.Text;

namespace SHTL.Service.Export;

/// <summary>Ghi lỗi export ra file dưới thư mục chạy: AppData/export-errors/ (mỗi ngày một file).</summary>
internal static class ExportErrorFileLog
{
    private static readonly object LockObj = new();

    public static void Append(long jobId, int? exportTypeId, string? exportTypeCode, string summary, string? detail)
    {
        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "AppData", "export-errors");
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"export-errors-{DateTime.UtcNow:yyyyMMdd}.log");
            var sb = new StringBuilder();
            sb.Append(DateTime.UtcNow.ToString("O"));
            sb.Append('\t').Append("JobId=").Append(jobId);
            sb.Append('\t').Append("ExportTypeId=").Append(exportTypeId?.ToString() ?? "-");
            sb.Append('\t').Append("Code=").Append(exportTypeCode ?? "-");
            sb.Append('\t').Append(OneLine(summary));
            if (!string.IsNullOrWhiteSpace(detail))
                sb.Append('\t').Append(OneLine(detail));
            sb.AppendLine();
            lock (LockObj)
                File.AppendAllText(file, sb.ToString(), Encoding.UTF8);
        }
        catch
        {
            /* không làm hỏng worker nếu ghi log thất bại */
        }
    }

    private static string OneLine(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\r\n", " | ").Replace('\n', ' ').Replace('\t', ' ');
    }
}
