using Microsoft.AspNetCore.Authentication.JwtBearer;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using System.Security.Claims;

namespace SHTL.Modules.Infrastructure.Identity;

public interface IAuthService
{
    Task<(bool success, string message, ClaimsPrincipal? principal)> LoginAsync(string userName, string password);
    Task<User?> GetUserByTokenAsync(string token);
}

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepo;
    private readonly IPasswordHasher _hasher;

    public AuthService(IUserRepository userRepo, IPasswordHasher hasher)
    {
        _userRepo = userRepo;
        _hasher = hasher;
    }

    public async Task<(bool success, string message, ClaimsPrincipal? principal)> LoginAsync(
        string userName, string password)
    {
        userName = (userName ?? string.Empty).Trim();
        password = (password ?? string.Empty).Trim();

        var user = await _userRepo.GetByUserNameAsync(userName);
        if (user is null)
            return (false, "Tên đăng nhập không tồn tại", null);

        if (!user.IsActive)
            return (false, "Tài khoản đã bị vô hiệu hóa", null);

        if (!_hasher.Verify(password, user.PasswordHash))
            return (false, "Mật khẩu không chính xác", null);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName),
            new(ClaimKeys.FullName, user.FullName),
        };

        if (user.IsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "admin"));
        else
        {
            var codes = await _userRepo.GetPermissionCodesForUserAsync(user.Id);
            foreach (var code in codes)
            {
                if (string.IsNullOrWhiteSpace(code)) continue;
                claims.Add(new Claim("permission", code.Trim(), ClaimValueTypes.String));
            }
        }

        var identity = new ClaimsIdentity(claims, JwtBearerDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        return (true, "Đăng nhập thành công", principal);
    }

    public async Task<User?> GetUserByTokenAsync(string token)
    {
        await Task.CompletedTask;
        return null;
    }
}
