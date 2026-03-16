using Core.Domain.Contracts;
using System.Security.Claims;

namespace Infrastructure.Identity;

/// <summary>Implements ICurrentUser từ HttpContext.User claims</summary>
public class CurrentUser : ICurrentUser
{
    private readonly ClaimsPrincipal _principal;

    public CurrentUser(ClaimsPrincipal principal)
    {
        _principal = principal;
    }

    public int Id => int.TryParse(_principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    public int ChannelId => int.TryParse(_principal.FindFirstValue("channel_id"), out var cid) ? cid : 0;
    public string UserName => _principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    public string FullName => _principal.FindFirstValue("full_name") ?? string.Empty;
    public bool IsAdmin => _principal.IsInRole("admin");

    public IEnumerable<string> Roles
        => _principal.FindAll(ClaimTypes.Role).Select(c => c.Value);

    public bool HasPermission(string module)
        => _principal.HasClaim("permission", module) || IsAdmin;
}

public static class ClaimKeys
{
    public const string ChannelId = "channel_id";
    public const string FullName = "full_name";
    public const string Permission = "permission";
}
