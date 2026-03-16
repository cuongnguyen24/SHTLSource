namespace Core.Domain.Entities.Msg;

/// <summary>Bảng: Core_Msg.notifications</summary>
public class Notification
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public int ToUserId { get; set; }
    public int FromUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? Url { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
    public string? Type { get; set; }
    public string? RefId { get; set; }
}
