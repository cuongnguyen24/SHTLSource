using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2PythonRunner
{
    private readonly IHostEnvironment _env;
    private readonly IOptions<SearchablePdfWorkerOptions> _options;
    private readonly ILogger<Pdf2PythonRunner> _logger;

    public Pdf2PythonRunner(
        IHostEnvironment env,
        IOptions<SearchablePdfWorkerOptions> options,
        ILogger<Pdf2PythonRunner> logger)
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
            _logger.LogError("Pdf2Layer: không tìm thấy script {Script}", script);
            return false;
        }

        if (!File.Exists(inputFullPath))
        {
            _logger.LogError("Pdf2Layer: không có file đầu vào {Path}", inputFullPath);
            return false;
        }

        try
        {
            if (File.Exists(outputFullPath))
                File.Delete(outputFullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Pdf2Layer: không xóa được file đích tạm");
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
                    "Pdf2Layer: Python thoát mã {Code}. stderr: {Err}. stdout: {Out}",
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
                _logger.LogWarning(killEx, "Pdf2Layer: dừng process Python");
            }

            _logger.LogWarning("Pdf2Layer: hết thời gian hoặc hủy");
            return false;
        }

        if (!File.Exists(outputFullPath) || new FileInfo(outputFullPath).Length == 0)
        {
            _logger.LogError("Pdf2Layer: file đầu ra không hợp lệ");
            return false;
        }

        return true;
    }
}
