namespace SHTL.Modules.Core.Domain.Entities.Acc;

/// <summary>Bảng dbo.acc_role_permissions — quyền theo mã (permission_code) gán cho role.</summary>
public class AccRolePermission
{
    public int Id { get; set; }
    public int RoleId { get; set; }
    public string PermissionCode { get; set; } = string.Empty;
}
