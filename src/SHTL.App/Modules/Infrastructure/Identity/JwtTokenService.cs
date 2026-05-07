using System.IdentityModel.Tokens.Jwt;
using SHTL;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace SHTL.Modules.Infrastructure.Identity;

public interface IJwtTokenService
{
    string CreateAccessToken(IEnumerable<Claim> claims, TimeSpan? lifetime = null);
}

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _opt;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _opt = options.Value;
    }

    public string CreateAccessToken(IEnumerable<Claim> claims, TimeSpan? lifetime = null)
    {
        if (string.IsNullOrWhiteSpace(_opt.SigningKey) || _opt.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromMinutes(_opt.AccessTokenMinutes));
        var token = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddSeconds(-30),
            expires: expires,
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
