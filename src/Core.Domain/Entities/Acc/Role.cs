namespace Core.Domain.Entities.Acc;

/// <summary>Bảng: Core_Acc.roles</summary>
public class Role : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Parent { get; set; }
    public string? Parents { get; set; }
    public string? ModuleCode { get; set; }
    public bool IsActive { get; set; } = true;
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Acc.user_roles</summary>
public class UserRole
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public int ChannelId { get; set; }
}

/// <summary>Bảng: Core_Acc.depts</summary>
public class Dept : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public int? ParentId { get; set; }     // Alias for Parent
    public int Parent { get; set; }
    public string? Parents { get; set; }
    public int Weight { get; set; }
    public string? SearchMeta { get; set; }
}

/// <summary>Bảng: Core_Acc.positions</summary>
public class Position : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Acc.teams</summary>
public class Team : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public int Weight { get; set; }
}

/// <summary>Bảng: Core_Acc.user_teams</summary>
public class UserTeam
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int TeamId { get; set; }
    public int ChannelId { get; set; }
}

/// <summary>Bảng: Core_Acc.user_depts</summary>
public class UserDept
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int DeptId { get; set; }
    public int ChannelId { get; set; }
    public bool IsPrimary { get; set; }
}

/// <summary>Bảng: Core_Acc.module_permissions</summary>
public class ModulePermission
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public int RoleId { get; set; }
    public int ModuleId { get; set; }
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
    public bool CanApprove { get; set; }
    public bool CanExport { get; set; }
}

/// <summary>Bảng: Core_Acc.user_sessions</summary>
public class UserSession
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public int ChannelId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
}
