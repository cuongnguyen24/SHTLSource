namespace SHTL.Modules.Core.Domain.Entities;

/// <summary>Base class cho mọi entity có tracking</summary>
public abstract class BaseEntity
{
    public DateTime Created { get; set; } = DateTime.UtcNow;
    public int CreatedBy { get; set; }
    public DateTime? Updated { get; set; }
    public int UpdatedBy { get; set; }
}

/// <summary>Giữ type alias cho entity từng gắn kênh; không còn cột channel.</summary>
public abstract class TenantEntity : BaseEntity;
