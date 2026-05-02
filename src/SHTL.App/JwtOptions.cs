namespace SHTL;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "SHTL";
    public string Audience { get; set; } = "SHTL.App";
    /// <summary>Symmetric key (min 32 chars for HS256).</summary>
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 480;
}
