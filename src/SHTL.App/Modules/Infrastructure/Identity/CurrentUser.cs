using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using System.Globalization;
using System.Security.Claims;

namespace SHTL.Modules.Infrastructure.Identity;

/// <summary>Implements ICurrentUser từ HttpContext.User claims</summary>
public class CurrentUser : ICurrentUser
{
    private readonly ClaimsPrincipal _principal;

    public CurrentUser(ClaimsPrincipal principal)
    {
        _principal = principal;
    }

    public int Id => ParseIntClaim(_principal, ClaimTypes.NameIdentifier)
        ?? ParseIntClaim(_principal, "sub")
        ?? ParseIntClaim(_principal, "uid")
        ?? ParseIntClaim(_principal, "user_id")
        ?? 0;
    public string UserName => _principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    public string FullName => _principal.FindFirstValue("full_name") ?? string.Empty;
    public bool IsAdmin => _principal.IsInRole("admin");

    public IEnumerable<string> Roles
        => _principal.FindAll(ClaimTypes.Role).Select(c => c.Value);

    public bool HasPermission(string module)
    {
        if (IsAdmin)
            return true;
        if (string.IsNullOrWhiteSpace(module))
            return false;

        var trimmed = module.Trim();
        if (_principal.HasClaim("permission", trimmed))
            return true;

        if (Enum.TryParse<ModuleCode>(trimmed, true, out var byName))
            return ModuleAuthorization.HasModule(_principal, byName);

        if (int.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var code)
            && Enum.IsDefined(typeof(ModuleCode), code))
            return ModuleAuthorization.HasModule(_principal, (ModuleCode)code);

        return false;
    }

    private static int? ParseIntClaim(ClaimsPrincipal p, string type)
    {
        var s = p.FindFirstValue(type);
        return int.TryParse(s, out var id) ? id : null;
    }
}

public static class ClaimKeys
{
    public const string FullName = "full_name";
    public const string Permission = "permission";
}
