using Microsoft.Extensions.Configuration;
using System.Net;
using System.Text;
using System.Text.Json;

namespace Plugin.Desktop;

public sealed class LocalPluginServer : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly CancellationTokenSource _cts = new();
    private readonly PluginSettings _settings;
    private readonly HttpClient _http = new();

    public event Action<string>? OnLog;

    public LocalPluginServer(PluginSettings settings)
    {
        _settings = settings;
        _listener.Prefixes.Add(_settings.ListenPrefix.EndsWith("/") ? _settings.ListenPrefix : _settings.ListenPrefix + "/");
    }

    public void Start()
    {
        _listener.Start();
        _ = Task.Run(() => LoopAsync(_cts.Token));
        Log($"Listening: {_settings.ListenPrefix}");
    }

    public void Stop()
    {
        _cts.Cancel();
        try { _listener.Stop(); } catch { /* ignore */ }
    }

    private async Task LoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = await _listener.GetContextAsync();
            }
            catch
            {
                if (ct.IsCancellationRequested) break;
                continue;
            }

            _ = Task.Run(() => HandleAsync(ctx), ct);
        }
    }

    private async Task HandleAsync(HttpListenerContext ctx)
    {
        try
        {
            var path = ctx.Request.Url?.AbsolutePath?.ToLowerInvariant() ?? "/";
            if (path.EndsWith("/ping"))
            {
                await WriteJsonAsync(ctx, 200, new { ok = true, time = DateTimeOffset.Now });
                return;
            }

            if (path.EndsWith("/upload") && ctx.Request.HttpMethod == "POST")
            {
                using var reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding ?? Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                var req = JsonSerializer.Deserialize<LocalUploadRequest>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                          ?? new LocalUploadRequest();

                if (string.IsNullOrWhiteSpace(req.FilePath) || !File.Exists(req.FilePath))
                {
                    await WriteJsonAsync(ctx, 400, new { ok = false, message = "FilePath invalid" });
                    return;
                }

                var result = await UploadAndCallbackAsync(req.FilePath);
                await WriteJsonAsync(ctx, result.ok ? 200 : 500, result);
                return;
            }

            await WriteJsonAsync(ctx, 404, new { ok = false, message = "Not found" });
        }
        catch (Exception ex)
        {
            Log("Error: " + ex);
            try { await WriteJsonAsync(ctx, 500, new { ok = false, message = ex.Message }); } catch { /* ignore */ }
        }
        finally
        {
            try { ctx.Response.OutputStream.Close(); } catch { /* ignore */ }
        }
    }

    private async Task<(bool ok, string message, object? uploader, object? gateway)> UploadAndCallbackAsync(string filePath)
    {
        Log($"Uploading: {filePath}");

        // 1) Upload to Web.Uploader
        using var form = new MultipartFormDataContent();
        await using var fs = File.OpenRead(filePath);
        form.Add(new StreamContent(fs), "file", Path.GetFileName(filePath));

        var uploaderUrl = $"{_settings.UploaderUrl}?ChannelId={_settings.ChannelId}&FolderId={_settings.FolderId}&DocTypeId={_settings.DocTypeId}&CreatedBy={_settings.CreatedBy}&SyncType={_settings.SyncType}";
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, uploaderUrl) { Content = form };
        if (!string.IsNullOrWhiteSpace(_settings.UploaderApiKey))
            uploadReq.Headers.Add("X-Api-Key", _settings.UploaderApiKey);

        var uploadResp = await _http.SendAsync(uploadReq);
        var uploadText = await uploadResp.Content.ReadAsStringAsync();
        if (!uploadResp.IsSuccessStatusCode)
            return (false, "Upload failed: " + uploadText, uploadText, null);

        var uploadObj = JsonSerializer.Deserialize<UploadFileResponse>(uploadText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (uploadObj == null || !uploadObj.Success)
            return (false, "Upload failed", uploadText, null);

        // 2) Callback to Api.Gateway to create Document
        var cb = new UploadCallbackRequest
        {
            ChannelId = _settings.ChannelId,
            FolderId = _settings.FolderId,
            DocTypeId = _settings.DocTypeId,
            CreatedBy = _settings.CreatedBy,
            FileName = uploadObj.FileName,
            StoredPath = uploadObj.StoredPath,
            FileSize = uploadObj.FileSize,
            Extension = uploadObj.Extension,
            WorkstationName = Environment.MachineName,
            SyncType = _settings.SyncType
        };

        var cbJson = JsonSerializer.Serialize(cb);
        using var cbReq = new HttpRequestMessage(HttpMethod.Post, _settings.GatewayCallbackUrl)
        {
            Content = new StringContent(cbJson, Encoding.UTF8, "application/json")
        };
        if (!string.IsNullOrWhiteSpace(_settings.GatewayApiKey))
            cbReq.Headers.Add("X-Api-Key", _settings.GatewayApiKey);

        var cbResp = await _http.SendAsync(cbReq);
        var cbText = await cbResp.Content.ReadAsStringAsync();
        if (!cbResp.IsSuccessStatusCode)
            return (false, "Callback failed: " + cbText, uploadObj, cbText);

        return (true, "OK", uploadObj, cbText);
    }

    private static async Task WriteJsonAsync(HttpListenerContext ctx, int status, object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.ContentLength64 = bytes.Length;
        await ctx.Response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
    }

    private void Log(string msg) => OnLog?.Invoke(msg);

    public void Dispose()
    {
        Stop();
        _listener.Close();
        _cts.Dispose();
        _http.Dispose();
    }
}

public class LocalUploadRequest
{
    public string FilePath { get; set; } = string.Empty;
}

public class UploadFileResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Extension { get; set; }
    public string? PublicUrl { get; set; }
}

public class UploadCallbackRequest
{
    public int ChannelId { get; set; }
    public long FolderId { get; set; }
    public int DocTypeId { get; set; }
    public int CreatedBy { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Extension { get; set; }
    public string? WorkstationName { get; set; }
    public int SyncType { get; set; }
    public string? ExcelMetaJson { get; set; }
}

