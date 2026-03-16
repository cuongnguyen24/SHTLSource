using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Web.ResumableUploader.Security;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class ApiKeyAuthAttribute : Attribute, IAuthorizationFilter
{
    public const string HeaderName = "X-Api-Key";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var cfg = context.HttpContext.RequestServices.GetService(typeof(IConfiguration)) as IConfiguration;
        var expected = cfg?["Resumable:ApiKey"];
        var allowAnonymous = bool.TryParse(cfg?["Resumable:AllowAnonymousUpload"], out var b) && b;

        if (allowAnonymous) return;

        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new StatusCodeResult(500);
            return;
        }

        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var apiKey) ||
            apiKey.Count == 0 ||
            apiKey[0] != expected)
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Missing/invalid api key" });
        }
    }
}

