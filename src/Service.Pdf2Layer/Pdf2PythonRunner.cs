using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2PythonRunner
{
    private readonly IHostEnvironment _env;
    private readonly IOptions<SearchablePdfWorkerOptions> _options;
    private readonly PythonDependencyBootstrapper _bootstrapper;
    private readonly ILogger<Pdf2PythonRunner> _logger;

    public Pdf2PythonRunner(
        IHostEnvironment env,
        IOptions<SearchablePdfWorkerOptions> options,
        PythonDependencyBootstrapper bootstrapper,
        ILogger<Pdf2PythonRunner> logger)
    {
        _env = env;
        _options = options;
        _bootstrapper = bootstrapper;
        _logger = logger;
    }

    public async Task<bool> RunAsync(
        string inputFullPath,
        string outputFullPath,
        int renderDpi,
        int maxPages,
        CancellationToken cancellationToken = default)
    {
        var opt = _options.Value;
        var script = Path.GetFullPath(Path.Combine(_env.ContentRootPath, opt.ScriptRelativePath));
        if (!File.Exists(script))
        {
            _logger.LogError("Pdf2Layer: không tìm thấy script {Script}", script);
            await AppDataFileLog.WriteAsync("ERROR", $"Không tìm thấy script OCR: {script}", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        if (!File.Exists(inputFullPath))
        {
            _logger.LogError("Pdf2Layer: không có file đầu vào {Path}", inputFullPath);
            await AppDataFileLog.WriteAsync("ERROR", $"Không tìm thấy file đầu vào: {inputFullPath}", cancellationToken: cancellationToken).ConfigureAwait(false);
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
            await AppDataFileLog.WriteAsync("WARN", $"Không xóa được file output tạm: {outputFullPath}", ex, cancellationToken).ConfigureAwait(false);
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(opt.TimeoutSeconds, 60, 7200)));

        using var proc = new Process();
        proc.StartInfo.FileName = _bootstrapper.ResolvePythonExecutable();
        proc.StartInfo.ArgumentList.Add(script);
        proc.StartInfo.ArgumentList.Add(inputFullPath);
        proc.StartInfo.ArgumentList.Add(outputFullPath);
        proc.StartInfo.ArgumentList.Add(renderDpi.ToString());
        proc.StartInfo.ArgumentList.Add(maxPages.ToString());
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
                await AppDataFileLog.WriteAsync(
                    "ERROR",
                    $"Python exit code={proc.ExitCode}. input={inputFullPath}; output={outputFullPath}; stderr={err.Trim()}; stdout={outp.Trim()}",
                    cancellationToken: cancellationToken).ConfigureAwait(false);
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
            await AppDataFileLog.WriteAsync("WARN", $"Python process timeout/cancel. input={inputFullPath}; output={outputFullPath}", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        if (!File.Exists(outputFullPath) || new FileInfo(outputFullPath).Length == 0)
        {
            _logger.LogError("Pdf2Layer: file đầu ra không hợp lệ");
            await AppDataFileLog.WriteAsync("ERROR", $"File đầu ra không hợp lệ hoặc rỗng: {outputFullPath}", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        return true;
    }
}
