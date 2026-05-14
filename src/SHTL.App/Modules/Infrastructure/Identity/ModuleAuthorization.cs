using System.Globalization;
using System.Security.Claims;
using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Infrastructure.Identity;

/// <summary>
/// Kiểm tra quyền module thống nhất: claim <c>permission</c> và ánh xạ <see cref="RoleModuleMap"/>.
/// </summary>
public static class ModuleAuthorization
{
    public static bool HasModule(ClaimsPrincipal user, ModuleCode module)
    {
        if (user.Identity?.IsAuthenticated != true)
            return false;
        if (user.IsInRole("admin"))
            return true;

        var name = module.ToString();
        var numeric = ((int)module).ToString(CultureInfo.InvariantCulture);
        if (user.HasClaim("permission", name) || user.HasClaim("permission", numeric))
            return true;

        return user.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .Any(rc => RoleModuleMap.RoleHasModule(rc, module));
    }

    public static bool HasAnyModule(ClaimsPrincipal user, params ModuleCode[] modules)
    {
        if (modules is null || modules.Length == 0)
            return false;
        return modules.Any(m => HasModule(user, m));
    }
}
