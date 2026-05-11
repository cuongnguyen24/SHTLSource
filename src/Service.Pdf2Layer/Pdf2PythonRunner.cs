using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2PythonRunner
{
    private const int MaxLogSnippetChars = 8000;

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

    /// <summary>Chi tiết lỗi ghi vào AppData ở <see cref="Pdf2Processor"/> (kèm documentId).</summary>
    public async Task<Pdf2PythonRunResult> RunAsync(
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
            var msg = $"Không tìm thấy script OCR: {script}";
            _logger.LogError("Pdf2Layer: không tìm thấy script {Script}", script);
            return Pdf2PythonRunResult.Fail(msg);
        }

        if (!File.Exists(inputFullPath))
        {
            var msg = $"Không tìm thấy file đầu vào (trước khi chạy Python): {inputFullPath}";
            _logger.LogError("Pdf2Layer: không có file đầu vào {Path}", inputFullPath);
            return Pdf2PythonRunResult.Fail(msg);
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
                var errT = err.Trim();
                var outT = outp.Trim();
                _logger.LogError(
                    "Pdf2Layer: Python thoát mã {Code}. stderr: {Err}. stdout: {Out}",
                    proc.ExitCode,
                    errT,
                    outT);
                var detail =
                    $"Python exitCode={proc.ExitCode}; exe={proc.StartInfo.FileName}; script={script}; " +
                    $"input={inputFullPath}; output={outputFullPath}; dpi={renderDpi}; maxPages={(maxPages <= 0 ? "ALL" : maxPages)}; " +
                    $"stderr={ClipForLog(errT)}; stdout={ClipForLog(outT)}";
                return Pdf2PythonRunResult.Fail(detail, proc.ExitCode);
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

            var msg =
                $"Python timeout hoặc bị hủy; exe={proc.StartInfo.FileName}; script={script}; input={inputFullPath}; output={outputFullPath}; " +
                $"timeoutSeconds={Math.Clamp(opt.TimeoutSeconds, 60, 7200)}";
            _logger.LogWarning("Pdf2Layer: hết thời gian hoặc hủy");
            return Pdf2PythonRunResult.Fail(msg);
        }

        if (!File.Exists(outputFullPath) || new FileInfo(outputFullPath).Length == 0)
        {
            var msg = $"File đầu ra không tồn tại hoặc rỗng sau khi Python exit 0: {outputFullPath}";
            _logger.LogError("Pdf2Layer: file đầu ra không hợp lệ");
            return Pdf2PythonRunResult.Fail(msg, 0);
        }

        return Pdf2PythonRunResult.Success();
    }

    private static string ClipForLog(string s)
    {
        if (string.IsNullOrEmpty(s)) return "(empty)";
        if (s.Length <= MaxLogSnippetChars) return s;
        return s[..MaxLogSnippetChars] + $"… [cắt bớt, tổng {s.Length} ký tự]";
    }
}
