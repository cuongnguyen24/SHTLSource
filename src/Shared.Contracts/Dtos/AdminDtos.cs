using System.ComponentModel.DataAnnotations;

namespace Shared.Contracts.Dtos;

// ---------- Role ----------
public class RoleDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateRoleRequest
{
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

// ---------- Dept ----------
public class DeptDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int? ParentId { get; set; }
}

public class CreateDeptRequest
{
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? ParentId { get; set; }
}

public class UpdateDeptRequest
{
    public int Id { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? ParentId { get; set; }
}

// ---------- Config ----------
public class ConfigItemDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public string? GroupName { get; set; }
    public string? Description { get; set; }
}

public class SaveConfigRequest
{
    [Required] public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
}

// ---------- Content Type ----------
public class ContentTypeDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class ContentTypeRequest
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Code { get; set; } = string.Empty;
}

// ---------- Record Type ----------
public class RecordTypeDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class RecordTypeRequest
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Code { get; set; } = string.Empty;
}

// ---------- Sync Type ----------
public class SyncTypeDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class SyncTypeRequest
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Code { get; set; } = string.Empty;
}

// ---------- Export Type ----------
public class ExportTypeDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? ExporterClass { get; set; }
    public bool IsActive { get; set; }
}

public class ExportTypeRequest
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Code { get; set; } = string.Empty;
    public string? ExporterClass { get; set; }
}

// ---------- Log ----------
public class ActionLogDto
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Module { get; set; }
    public string? ObjectType { get; set; }
    public string? ObjectId { get; set; }
    public string? Detail { get; set; }
    public string? IpAddress { get; set; }
    public DateTime Created { get; set; }
}

public class AccessLogDto
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string Path { get; set; } = string.Empty;
    public string? Method { get; set; }
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime Created { get; set; }
}
