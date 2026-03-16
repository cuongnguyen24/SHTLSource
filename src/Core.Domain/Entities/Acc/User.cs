namespace Core.Domain.Entities.Acc;

/// <summary>Bảng: Core_Acc.users</summary>
public class User : BaseEntity
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public int DeptId { get; set; }
    public int PositionId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsAdmin { get; set; }
    public string? Avatar { get; set; }
    public string? Phone { get; set; }
    public DateTime? LastLogin { get; set; }
    public string? SearchMeta { get; set; }
    public int Weight { get; set; }
}
