namespace SHTL.Modules.Core.Domain.Entities.Cnf;

/// <summary>Bảng dbo.cnf_configs — cặp key/value theo kênh.</summary>
public class CnfConfigEntry
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public string? GroupName { get; set; }
    public string? Description { get; set; }
}
