using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SHTL.Service.Ocr;

internal sealed class PythonDependencyBootstrapper
{
    private static readonly HttpClient Http = new();
    private readonly IHostEnvironment _env;
    private readonly IOptions<OcrSearchablePdfWorkerOptions> _options;
    private readonly ILogger<PythonDependencyBootstrapper> _logger;

    public PythonDependencyBootstrapper(
        IHostEnvironment env,
        IOptions<OcrSearchablePdfWorkerOptions> options,
        ILogger<PythonDependencyBootstrapper> logger)
    {
        _env = env;
        _options = options;
        _logger = logger;
    }

    public string ResolvePythonExecutable()
    {
        var configured = (_options.Value.PythonExecutable ?? string.Empty).Trim();
        if (Path.IsPathRooted(configured) && File.Exists(configured))
            return configured;

        var localEmbedded = Path.Combine(_env.ContentRootPath, "python", "python.exe");
        if (File.Exists(localEmbedded))
            return localEmbedded;

        return string.IsNullOrWhiteSpace(configured) ? "python" : configured;
    }

    public async Task<bool> EnsureReadyAsync(CancellationToken cancellationToken = default)
    {
        var python = await EnsurePythonRuntimeAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(python))
            return false;

        var importOk = await RunPythonCommandAsync(
            python,
            new[] { "-c", "import fitz; import vncv; print('ok')" },
            cancellationToken).ConfigureAwait(false);

        if (importOk.exitCode == 0)
            return true;

        if (!_options.Value.AutoInstallPythonDependencies)
        {
            _logger.LogError("OcrService: thiếu package Python (vncv/fitz) và AutoInstallPythonDependencies=false.");
            await AppDataFileLog.WriteAsync("ERROR", "Thiếu package Python vncv/fitz và AutoInstallPythonDependencies=false.", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        _logger.LogWarning("OcrService: thiếu dependency Python, bắt đầu tự cài...");
        var pipReady = await EnsurePipAsync(python, cancellationToken).ConfigureAwait(false);
        if (!pipReady)
        {
            _logger.LogError("OcrService: không thể khởi tạo pip.");
            await AppDataFileLog.WriteAsync("ERROR", "Không thể khởi tạo pip cho Python runtime.", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        var requirements = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.Value.RequirementsRelativePath));
        if (!File.Exists(requirements))
        {
            _logger.LogError("OcrService: không tìm thấy requirements file {Path}", requirements);
            await AppDataFileLog.WriteAsync("ERROR", $"Không tìm thấy requirements file: {requirements}", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        var installArgs = new List<string> { "-m", "pip", "install", "-r", requirements };
        if (!string.IsNullOrWhiteSpace(_options.Value.OfflineWheelhouseRelativePath))
        {
            var wheelhouse = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.Value.OfflineWheelhouseRelativePath));
            if (Directory.Exists(wheelhouse))
            {
                installArgs.Add("--no-index");
                installArgs.Add("--find-links");
                installArgs.Add(wheelhouse);
            }
        }

        var install = await RunPythonCommandAsync(python, installArgs, cancellationToken).ConfigureAwait(false);
        if (install.exitCode != 0)
        {
            _logger.LogError("OcrService: tự cài dependency thất bại.");
            await AppDataFileLog.WriteAsync("ERROR", "Tự cài dependency Python thất bại.", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        var verify = await RunPythonCommandAsync(
            python,
            new[] { "-c", "import fitz; import vncv; print('ok')" },
            cancellationToken).ConfigureAwait(false);

        if (verify.exitCode != 0)
        {
            _logger.LogError("OcrService: verify dependency thất bại.");
            await AppDataFileLog.WriteAsync("ERROR", "Verify dependency Python thất bại.", cancellationToken: cancellationToken).ConfigureAwait(false);
            return false;
        }

        _logger.LogInformation("OcrService: dependency Python đã sẵn sàng.");
        return true;
    }

    private async Task<string?> EnsurePythonRuntimeAsync(CancellationToken cancellationToken)
    {
        var python = ResolvePythonExecutable();
        var probe = await RunPythonCommandAsync(python, new[] { "--version" }, cancellationToken).ConfigureAwait(false);
        if (probe.exitCode == 0)
            return python;

        if (!_options.Value.AutoProvisionEmbeddedPython)
        {
            _logger.LogError("OcrService: máy đích chưa có Python runtime và AutoProvisionEmbeddedPython=false.");
            await AppDataFileLog.WriteAsync("ERROR", "Máy đích chưa có Python runtime và AutoProvisionEmbeddedPython=false.", cancellationToken: cancellationToken).ConfigureAwait(false);
            return null;
        }

        var embeddedPython = Path.Combine(_env.ContentRootPath, "python", "python.exe");
        if (File.Exists(embeddedPython))
        {
            var embeddedProbe = await RunPythonCommandAsync(embeddedPython, new[] { "--version" }, cancellationToken).ConfigureAwait(false);
            if (embeddedProbe.exitCode == 0)
                return embeddedPython;
        }

        var installed = await InstallEmbeddedPythonAsync(cancellationToken).ConfigureAwait(false);
        if (!installed)
            return null;

        var verify = await RunPythonCommandAsync(embeddedPython, new[] { "--version" }, cancellationToken).ConfigureAwait(false);
        return verify.exitCode == 0 ? embeddedPython : null;
    }

    private async Task<bool> InstallEmbeddedPythonAsync(CancellationToken cancellationToken)
    {
        var opt = _options.Value;
        var version = string.IsNullOrWhiteSpace(opt.EmbeddedPythonVersion) ? "3.12.10" : opt.EmbeddedPythonVersion.Trim();
        var downloadUrl = string.IsNullOrWhiteSpace(opt.EmbeddedPythonDownloadUrl)
            ? $"https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip"
            : opt.EmbeddedPythonDownloadUrl.Trim();

        var pythonDir = Path.Combine(_env.ContentRootPath, "python");
        Directory.CreateDirectory(pythonDir);
        var zipPath = Path.Combine(_env.ContentRootPath, "python-embed.zip");
        var tempDir = Path.Combine(_env.ContentRootPath, $"python-extract-{Guid.NewGuid():N}");

        try
        {
            _logger.LogInformation("OcrService: tải Python embeddable từ {Url}", downloadUrl);
            await using (var netStream = await Http.GetStreamAsync(downloadUrl, cancellationToken).ConfigureAwait(false))
            await using (var fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await netStream.CopyToAsync(fs, cancellationToken).ConfigureAwait(false);
            }

            Directory.CreateDirectory(tempDir);
            ZipFile.ExtractToDirectory(zipPath, tempDir, overwriteFiles: true);

            foreach (var existing in Directory.GetFiles(pythonDir, "*", SearchOption.AllDirectories))
                File.Delete(existing);
            foreach (var existingDir in Directory.GetDirectories(pythonDir))
                Directory.Delete(existingDir, recursive: true);

            foreach (var srcFile in Directory.GetFiles(tempDir, "*", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(tempDir, srcFile);
                var dst = Path.Combine(pythonDir, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
                File.Copy(srcFile, dst, overwrite: true);
            }

            PrepareEmbeddedPythonPathFile(pythonDir);
            _logger.LogInformation("OcrService: đã giải nén Python embeddable vào {Path}", pythonDir);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OcrService: không thể tải/cài Python embeddable");
            await AppDataFileLog.WriteAsync("ERROR", "Không thể tải/cài Python embeddable.", ex, cancellationToken).ConfigureAwait(false);
            return false;
        }
        finally
        {
            try { if (File.Exists(zipPath)) File.Delete(zipPath); } catch { }
            try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, recursive: true); } catch { }
        }
    }

    private static void PrepareEmbeddedPythonPathFile(string pythonDir)
    {
        var pthFile = Directory.GetFiles(pythonDir, "python*._pth").FirstOrDefault();
        if (string.IsNullOrWhiteSpace(pthFile) || !File.Exists(pthFile))
            return;

        var lines = File.ReadAllLines(pthFile).ToList();
        var hasSitePackages = lines.Any(x => x.Trim().Equals("Lib/site-packages", StringComparison.OrdinalIgnoreCase));
        if (!hasSitePackages)
            lines.Add("Lib/site-packages");

        var importSiteIdx = lines.FindIndex(x => x.Contains("import site", StringComparison.OrdinalIgnoreCase));
        if (importSiteIdx >= 0)
            lines[importSiteIdx] = "import site";
        else
            lines.Add("import site");

        File.WriteAllLines(pthFile, lines);
        Directory.CreateDirectory(Path.Combine(pythonDir, "Lib", "site-packages"));
    }

    private async Task<bool> EnsurePipAsync(string pythonExecutable, CancellationToken cancellationToken)
    {
        var pipCheck = await RunPythonCommandAsync(
            pythonExecutable,
            new[] { "-m", "pip", "--version" },
            cancellationToken).ConfigureAwait(false);
        if (pipCheck.exitCode == 0)
            return true;

        var getPip = Path.Combine(_env.ContentRootPath, "get-pip.py");
        try
        {
            _logger.LogInformation("OcrService: tải get-pip.py từ {Url}", _options.Value.GetPipUrl);
            await using (var netStream = await Http.GetStreamAsync(_options.Value.GetPipUrl, cancellationToken).ConfigureAwait(false))
            await using (var fs = new FileStream(getPip, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await netStream.CopyToAsync(fs, cancellationToken).ConfigureAwait(false);
            }

            var install = await RunPythonCommandAsync(
                pythonExecutable,
                new[] { getPip, "--disable-pip-version-check" },
                cancellationToken).ConfigureAwait(false);
            if (install.exitCode != 0)
                return false;

            var verify = await RunPythonCommandAsync(
                pythonExecutable,
                new[] { "-m", "pip", "--version" },
                cancellationToken).ConfigureAwait(false);
            return verify.exitCode == 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OcrService: cài pip thất bại");
            await AppDataFileLog.WriteAsync("ERROR", "Cài pip thất bại.", ex, cancellationToken).ConfigureAwait(false);
            return false;
        }
        finally
        {
            try { if (File.Exists(getPip)) File.Delete(getPip); } catch { }
        }
    }

    private async Task<(int exitCode, string stdout, string stderr)> RunPythonCommandAsync(
        string executable,
        IEnumerable<string> args,
        CancellationToken cancellationToken)
    {
        using var proc = new Process();
        proc.StartInfo.FileName = executable;
        foreach (var arg in args)
            proc.StartInfo.ArgumentList.Add(arg);
        proc.StartInfo.UseShellExecute = false;
        proc.StartInfo.CreateNoWindow = true;
        proc.StartInfo.RedirectStandardOutput = true;
        proc.StartInfo.RedirectStandardError = true;

        try
        {
            proc.Start();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OcrService: không khởi chạy Python executable {Path}", executable);
            await AppDataFileLog.WriteAsync("ERROR", $"Không khởi chạy được Python executable: {executable}", ex, cancellationToken).ConfigureAwait(false);
            return (-1, string.Empty, ex.Message);
        }

        var stdoutTask = proc.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = proc.StandardError.ReadToEndAsync(cancellationToken);
        await proc.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        var stdout = await stdoutTask.ConfigureAwait(false);
        var stderr = await stderrTask.ConfigureAwait(false);

        if (proc.ExitCode != 0)
        {
            _logger.LogWarning(
                "OcrService: lệnh Python thất bại (code={Code}). out={Out}; err={Err}",
                proc.ExitCode,
                stdout.Trim(),
                stderr.Trim());
            await AppDataFileLog.WriteAsync(
                "WARN",
                $"Lệnh Python thất bại code={proc.ExitCode}. exec={executable}; out={stdout.Trim()}; err={stderr.Trim()}",
                cancellationToken: cancellationToken).ConfigureAwait(false);
        }

        return (proc.ExitCode, stdout, stderr);
    }
}
