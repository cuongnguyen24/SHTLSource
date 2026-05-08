using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Options;

namespace SHTL.Modules.Core.Application.Services;

/// <summary>Gọi script Python tạo PDF 2 lớp (VNCV + PyMuPDF).</summary>
public interface ISearchablePdfPythonRunner
{
    Task<bool> RunAsync(string inputFullPath, string outputFullPath, int renderDpi, CancellationToken cancellationToken = default);
}

public sealed class SearchablePdfPythonRunner : ISearchablePdfPythonRunner
{
    private readonly IHostEnvironment _env;
    private readonly IOptions<SearchablePdfOptions> _options;
    private readonly ILogger<SearchablePdfPythonRunner> _logger;

    public SearchablePdfPythonRunner(
        IHostEnvironment env,
        IOptions<SearchablePdfOptions> options,
        ILogger<SearchablePdfPythonRunner> logger)
    {
        _env = env;
        _options = options;
        _logger = logger;
    }

    public async Task<bool> RunAsync(string inputFullPath, string outputFullPath, int renderDpi, CancellationToken cancellationToken = default)
    {
        var opt = _options.Value;
        var script = Path.GetFullPath(Path.Combine(_env.ContentRootPath, opt.ScriptRelativePath));
        if (!File.Exists(script))
        {
            _logger.LogError("Searchable PDF: không tìm thấy script {Script}", script);
            return false;
        }

        if (!File.Exists(inputFullPath))
        {
            _logger.LogError("Searchable PDF: không có file đầu vào {Path}", inputFullPath);
            return false;
        }

        try
        {
            if (File.Exists(outputFullPath))
                File.Delete(outputFullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Searchable PDF: không xóa được file đích tạm {Path}", outputFullPath);
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(opt.TimeoutSeconds, 60, 7200)));

        using var proc = new Process();
        proc.StartInfo.FileName = opt.PythonExecutable;
        proc.StartInfo.ArgumentList.Add(script);
        proc.StartInfo.ArgumentList.Add(inputFullPath);
        proc.StartInfo.ArgumentList.Add(outputFullPath);
        proc.StartInfo.ArgumentList.Add(renderDpi.ToString());
        proc.StartInfo.UseShellExecute = false;
        proc.StartInfo.CreateNoWindow = true;
        proc.StartInfo.RedirectStandardOutput = true;
        proc.StartInfo.RedirectStandardError = true;

        try
        {
            proc.Start();
            var errTask = proc.StandardError.ReadToEndAsync(timeoutCts.Token);
            var outTask = proc.StandardOutput.ReadToEndAsync(timeoutCts.Token);
            await proc.WaitForExitAsync(timeoutCts.Token).ConfigureAwait(false);
            var err = await errTask.ConfigureAwait(false);
            var outp = await outTask.ConfigureAwait(false);

            if (proc.ExitCode != 0)
            {
                _logger.LogError(
                    "Searchable PDF: Python thoát mã {Code}. stderr: {Err}. stdout: {Out}",
                    proc.ExitCode,
                    err.Trim(),
                    outp.Trim());
                return false;
            }
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!proc.HasExited)
                    proc.Kill(entireProcessTree: true);
            }
            catch (Exception killEx)
            {
                _logger.LogWarning(killEx, "Searchable PDF: dừng process Python");
            }

            _logger.LogWarning("Searchable PDF: hết thời gian hoặc hủy khi xử lý tài liệu");
            return false;
        }

        if (!File.Exists(outputFullPath) || new FileInfo(outputFullPath).Length == 0)
        {
            _logger.LogError("Searchable PDF: không tạo được file đầu ra hợp lệ");
            return false;
        }

        return true;
    }
}
