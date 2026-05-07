using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace SHTL.Routing;

/// <summary>Maps controller namespaces under <c>SHTL.Modules.Features.*</c> to MVC areas for URL prefixes.</summary>
public sealed class FeatureModuleAreaConvention : IControllerModelConvention
{
    private static readonly (string NamespaceToken, string AreaName)[] Map =
    {
        (".Features.Account", "account"),
        (".Features.Admin", "admin"),
        (".Features.Dashboard", "dashboard"),
        (".Features.SoHoa", "sohoa"),
        (".Features.Uploader", "uploader"),
    };

    public void Apply(ControllerModel controller)
    {
        var ns = controller.ControllerType.Namespace ?? "";
        foreach (var (token, area) in Map)
        {
            if (!ns.Contains(token, StringComparison.Ordinal))
                continue;
            if (!controller.RouteValues.ContainsKey("area"))
                controller.RouteValues["area"] = area;
            return;
        }
    }
}
