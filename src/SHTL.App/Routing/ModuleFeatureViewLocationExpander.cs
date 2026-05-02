using Microsoft.AspNetCore.Mvc.Razor;

namespace SHTL.Routing;

/// <summary>Resolves Razor views under <c>Modules/Features/{Feature}/Views</c> for area routes.</summary>
public sealed class ModuleFeatureViewLocationExpander : IViewLocationExpander
{
    public void PopulateValues(ViewLocationExpanderContext context) { }

    public IEnumerable<string> ExpandViewLocations(
        ViewLocationExpanderContext context,
        IEnumerable<string> viewLocations)
    {
        if (string.IsNullOrEmpty(context.AreaName))
        {
            foreach (var v in viewLocations)
                yield return v;
            yield break;
        }

        var area = context.AreaName;
        var folder = area.Length == 0
            ? area
            : char.ToUpperInvariant(area[0]) + area.Substring(1);

        yield return $"/Modules/Features/{folder}/Views/{{1}}/{{0}}.cshtml";
        yield return $"/Modules/Features/{folder}/Views/Shared/{{0}}.cshtml";

        // Layout/partial dùng chung (Features/Shared), ví dụ _LayoutLoginSb, _LayoutShell.
        yield return "/Modules/Features/Shared/Views/Shared/{0}.cshtml";
        yield return "/Modules/Features/Shared/Views/{1}/{0}.cshtml";

        foreach (var v in viewLocations)
            yield return v;
    }
}
