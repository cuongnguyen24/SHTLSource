using System.Net;
using System.Text;
using System.Text.Json;

namespace SHTL.Plugin.Sync;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        var form = new MainForm();
        using var bridge = new LocalBridgeServer(form);
        bridge.Start();

        Application.Run(form);
    }
}

internal sealed class LocalBridgeServer : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly MainForm _form;
    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    public LocalBridgeServer(MainForm form)
    {
        _form = form;
        _listener.Prefixes.Add("http://127.0.0.1:18181/");
    }

    public void Start()
    {
        _cts = new CancellationTokenSource();
        _listener.Start();
        _loopTask = Task.Run(() => AcceptLoopAsync(_cts.Token));
    }

    private async Task AcceptLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            HttpListenerContext? ctx = null;
            try
            {
                ctx = await _listener.GetContextAsync();
                _ = Task.Run(() => HandleAsync(ctx), cancellationToken);
            }
            catch
            {
                if (ctx is not null)
                    ctx.Response.Close();
            }
        }
    }

    private async Task HandleAsync(HttpListenerContext ctx)
    {
        var path = ctx.Request.Url?.AbsolutePath?.ToLowerInvariant() ?? "/";
        if (ctx.Request.HttpMethod == "OPTIONS")
        {
            WriteCors(ctx.Response);
            ctx.Response.StatusCode = 200;
            ctx.Response.Close();
            return;
        }

        if (path == "/health")
        {
            await WriteJsonAsync(ctx.Response, "{\"status\":\"ok\",\"service\":\"SHTL.Plugin.Sync\"}");
            return;
        }

        if (path == "/activate")
        {
            _form.BeginInvoke(new Action(_form.ActivateFromRemote));
            await WriteJsonAsync(ctx.Response, "{\"status\":\"ok\"}");
            return;
        }

        if (path == "/configure" && ctx.Request.HttpMethod == "POST")
        {
            PluginSyncConfig? config = null;
            try
            {
                using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                var body = await reader.ReadToEndAsync();
                config = JsonSerializer.Deserialize<PluginSyncConfig>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch
            {
                config = null;
            }

            _form.BeginInvoke(new Action(() => _form.ApplyConfiguration(config)));
            await WriteJsonAsync(ctx.Response, "{\"status\":\"ok\"}");
            return;
        }

        ctx.Response.StatusCode = 404;
        ctx.Response.Close();
    }

    private static async Task WriteJsonAsync(HttpListenerResponse response, string json)
    {
        WriteCors(response);
        response.StatusCode = 200;
        response.ContentType = "application/json; charset=utf-8";
        var data = Encoding.UTF8.GetBytes(json);
        await response.OutputStream.WriteAsync(data, 0, data.Length);
        response.Close();
    }

    private static void WriteCors(HttpListenerResponse response)
    {
        response.Headers["Access-Control-Allow-Origin"] = "*";
        response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
        response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    }

    public void Dispose()
    {
        try { _cts?.Cancel(); } catch { }
        try { _listener.Stop(); } catch { }
        try { _listener.Close(); } catch { }
    }
}
