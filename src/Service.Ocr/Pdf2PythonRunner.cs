using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Ocr;

internal sealed class OcrPythonRunner
{
    private const int MaxLogSnippetChars = 8000;

    private readonly IHostEnvironment _env;
    private readonly IOptions<OcrSearchablePdfWorkerOptions> _options;
    private readonly PythonDependencyBootstrapper _bootstrapper;
    private readonly ILogger<OcrPythonRunner> _logger;

    public OcrPythonRunner(
        IHostEnvironment env,
        IOptions<OcrSearchablePdfWorkerOptions> options,
        PythonDependencyBootstrapper bootstrapper,
        ILogger<OcrPythonRunner> logger)
    {
        _env = env;
        _options = options;
        _bootstrapper = bootstrapper;
        _logger = logger;
    }

    /// <summary>Chi tiết lỗi ghi vào AppData ở <see cref="OcrProcessor"/> (kèm documentId).</summary>
    public async Task<OcrPythonRunResult> RunAsync(
        string inputFullPath,
        string outputFullPath,
        int renderDpi,
        int maxPages,
        IReadOnlyCollection<int>? selectedPages,
        string? jsonOutputFullPath,
        CancellationToken cancellationToken = default)
    {
        var opt = _options.Value;
        var script = Path.GetFullPath(Path.Combine(_env.ContentRootPath, opt.ScriptRelativePath));
        if (!File.Exists(script))
        {
            var msg = $"Không tìm thấy script OCR: {script}";
            _logger.LogError("OcrService: không tìm thấy script {Script}", script);
            return OcrPythonRunResult.Fail(msg);
        }

        if (!File.Exists(inputFullPath))
        {
            var msg = $"Không tìm thấy file đầu vào (trước khi chạy Python): {inputFullPath}";
            _logger.LogError("OcrService: không có file đầu vào {Path}", inputFullPath);
            return OcrPythonRunResult.Fail(msg);
        }

        try
        {
            if (File.Exists(outputFullPath))
                File.Delete(outputFullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OcrService: không xóa được file đích tạm");
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
        proc.StartInfo.ArgumentList.Add(
            selectedPages is { Count: > 0 }
                ? string.Join(",", selectedPages.OrderBy(x => x))
                : string.Empty);
        proc.StartInfo.ArgumentList.Add(jsonOutputFullPath ?? string.Empty);
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
                    "OcrService: Python thoát mã {Code}. stderr: {Err}. stdout: {Out}",
                    proc.ExitCode,
                    errT,
                    outT);
                var detail =
                    $"Python exitCode={proc.ExitCode}; exe={proc.StartInfo.FileName}; script={script}; " +
                    $"input={inputFullPath}; output={outputFullPath}; dpi={renderDpi}; maxPages={(maxPages <= 0 ? "ALL" : maxPages)}; " +
                    $"stderr={ClipForLog(errT)}; stdout={ClipForLog(outT)}";
                return OcrPythonRunResult.Fail(detail, proc.ExitCode);
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
                _logger.LogWarning(killEx, "OcrService: dừng process Python");
            }

            var msg =
                $"Python timeout hoặc bị hủy; exe={proc.StartInfo.FileName}; script={script}; input={inputFullPath}; output={outputFullPath}; " +
                $"timeoutSeconds={Math.Clamp(opt.TimeoutSeconds, 60, 7200)}";
            _logger.LogWarning("OcrService: hết thời gian hoặc hủy");
            return OcrPythonRunResult.Fail(msg);
        }

        if (!File.Exists(outputFullPath) || new FileInfo(outputFullPath).Length == 0)
        {
            var msg = $"File đầu ra không tồn tại hoặc rỗng sau khi Python exit 0: {outputFullPath}";
            _logger.LogError("OcrService: file đầu ra không hợp lệ");
            return OcrPythonRunResult.Fail(msg, 0);
        }

        return OcrPythonRunResult.Success();
    }

    private static string ClipForLog(string s)
    {
        if (string.IsNullOrEmpty(s)) return "(empty)";
        if (s.Length <= MaxLogSnippetChars) return s;
        return s[..MaxLogSnippetChars] + $"… [cắt bớt, tổng {s.Length} ký tự]";
    }
}
