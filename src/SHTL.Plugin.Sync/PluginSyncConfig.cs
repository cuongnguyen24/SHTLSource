namespace SHTL.Plugin.Sync;

public sealed class PluginSyncConfig
{
    public string UploadUrl { get; set; } = string.Empty;
    public string UploadChunkUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public int CreatedBy { get; set; }
    public List<PluginSyncTypeItem> Items { get; set; } = new();
}

public sealed class PluginSyncTypeItem
{
    public int SyncTypeId { get; set; }
    public int DocTypeId { get; set; }
    public string DocTypeName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Format { get; set; }
    public string? ScanPathRoot { get; set; }
    public int Weight { get; set; }
    public bool IsDefault { get; set; }
    public List<PluginSyncSettingItem> Settings { get; set; } = new();
}

public sealed class PluginSyncSettingItem
{
    public int Id { get; set; }
    public int IdField { get; set; }
    public string? Title { get; set; }
    public int Weight { get; set; }
    public bool IsRequired { get; set; }
}
