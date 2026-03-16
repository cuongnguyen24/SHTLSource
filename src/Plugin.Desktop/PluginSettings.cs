namespace Plugin.Desktop;

public class PluginSettings
{
    public string ListenPrefix { get; set; } = "http://localhost:81/plugin/";
    public string UploaderUrl { get; set; } = string.Empty;
    public string GatewayCallbackUrl { get; set; } = string.Empty;
    public string? UploaderApiKey { get; set; }
    public string? GatewayApiKey { get; set; }
    public int ChannelId { get; set; } = 1;
    public int CreatedBy { get; set; } = 1;
    public int DocTypeId { get; set; } = 1;
    public long FolderId { get; set; } = 0;
    public int SyncType { get; set; } = 2;
}

