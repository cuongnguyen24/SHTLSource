using System.Text;
using Microsoft.AspNetCore.Hosting;

namespace Web.Account.Logging;

/// <summary>
/// Ghi exception ra file trong ContentRoot/app-data/logs/ (không phụ thuộc ILogger console).
/// </summary>
public static class AppDataErrorLogger
{
    public static void WriteException(IWebHostEnvironment env, Exception ex, string context)
    {
        try
        {
            var dir = Path.Combine(env.ContentRootPath, "app-data", "logs");
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"errors-{DateTime.UtcNow:yyyyMMdd}.log");

            var sb = new StringBuilder();
            sb.AppendLine($"=== {DateTime.UtcNow:O} UTC | {context} ===");
            sb.AppendLine($"Environment: {env.EnvironmentName}");
            sb.AppendLine($"ContentRoot: {env.ContentRootPath}");
            sb.AppendLine($"AppBaseDir: {AppContext.BaseDirectory}");
            var cfg = Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json");
            sb.AppendLine($"config/connectionstrings.json exists: {File.Exists(cfg)}");
            sb.AppendLine(ex.ToString());
            sb.AppendLine();
            File.AppendAllText(file, sb.ToString(), Encoding.UTF8);
        }
        catch
        {
            // bỏ qua lỗi phụ khi ghi log
        }
    }
}
