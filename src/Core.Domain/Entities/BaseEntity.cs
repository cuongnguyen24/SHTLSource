namespace Core.Domain.Entities;

/// <summary>Base class cho mọi entity có tracking</summary>
public abstract class BaseEntity
{
    public DateTime Created { get; set; } = DateTime.UtcNow;
    public int CreatedBy { get; set; }
    public DateTime? Updated { get; set; }
    public int UpdatedBy { get; set; }
}

public abstract class TenantEntity : BaseEntity
{
    public int ChannelId { get; set; }
}
