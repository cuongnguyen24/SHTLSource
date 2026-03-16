namespace Shared.Contracts.Dtos;

public class ProfileVm
{
    public int UserId { get; set; }
    public int ChannelId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public List<string> Roles { get; set; } = new();
}

