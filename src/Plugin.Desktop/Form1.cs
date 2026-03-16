using Microsoft.Extensions.Configuration;

namespace Plugin.Desktop;

public partial class Form1 : Form
{
    private readonly TextBox _log = new() { Multiline = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill };
    private readonly Button _btnStart = new() { Text = "Start local endpoint", Dock = DockStyle.Top, Height = 40 };
    private readonly Button _btnUpload = new() { Text = "Chọn file & Upload", Dock = DockStyle.Top, Height = 40 };

    private LocalPluginServer? _server;
    private PluginSettings _settings = new();

    public Form1()
    {
        InitializeComponent();
        Text = "Plugin.Desktop - Scan/Upload (stub)";
        Width = 900;
        Height = 600;

        LoadSettings();

        var panel = new Panel { Dock = DockStyle.Top, Height = 85 };
        panel.Controls.Add(_btnUpload);
        panel.Controls.Add(_btnStart);

        Controls.Add(_log);
        Controls.Add(panel);

        _btnStart.Click += (_, _) => StartServer();
        _btnUpload.Click += async (_, _) => await UploadFileAsync();
        FormClosing += (_, _) => { try { _server?.Dispose(); } catch { } };

        Log($"Config ListenPrefix={_settings.ListenPrefix}");
        Log($"UploaderUrl={_settings.UploaderUrl}");
        Log($"GatewayCallbackUrl={_settings.GatewayCallbackUrl}");
    }

    private void LoadSettings()
    {
        var cfg = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        cfg.GetSection("Plugin").Bind(_settings);
    }

    private void StartServer()
    {
        if (_server != null)
        {
            Log("Server already started.");
            return;
        }

        _server = new LocalPluginServer(_settings);
        _server.OnLog += Log;
        _server.Start();
    }

    private async Task UploadFileAsync()
    {
        if (_server == null) StartServer();

        using var dlg = new OpenFileDialog
        {
            Title = "Chọn file để upload",
            Filter = "All files|*.*"
        };
        if (dlg.ShowDialog() != DialogResult.OK) return;

        // Call local endpoint /upload (same process; for demonstration)
        var http = new HttpClient();
        var url = _settings.ListenPrefix.TrimEnd('/') + "/upload";
        var payload = System.Text.Json.JsonSerializer.Serialize(new { filePath = dlg.FileName });
        var resp = await http.PostAsync(url, new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
        var txt = await resp.Content.ReadAsStringAsync();
        Log($"Local upload result ({(int)resp.StatusCode}): {txt}");
    }

    private void Log(string msg)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action<string>(Log), msg);
            return;
        }
        _log.AppendText($"[{DateTime.Now:HH:mm:ss}] {msg}{Environment.NewLine}");
    }
}
