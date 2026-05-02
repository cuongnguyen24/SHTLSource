namespace SHTL.Modules.Infrastructure.Identity;

public interface IPasswordHasher
{
    /// <summary>Hash mật khẩu để lưu vào database.</summary>
    string Hash(string password);
    /// <summary>Verify mật khẩu với hash trong database.</summary>
    bool Verify(string password, string hash);
}

/// <summary>
/// BCrypt password hasher - bảo mật cao.
/// Sử dụng BCrypt với work factor 12.
/// </summary>
public sealed class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string password)
    {
        if (string.IsNullOrEmpty(password))
            return string.Empty;
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            // Fallback cho legacy plaintext passwords
            var trimmedPassword = password.Trim();
            var trimmedHash = hash.Trim();
            return string.Equals(trimmedPassword, trimmedHash, StringComparison.Ordinal);
        }
    }
}

/// <summary>
/// Legacy plaintext password hasher - CHỈ dùng cho migration.
/// KHÔNG sử dụng trong production.
/// </summary>
[Obsolete("Chỉ dùng để migrate password cũ. Sử dụng BCryptPasswordHasher.")]
public sealed class PlaintextPasswordHasher : IPasswordHasher
{
    public string Hash(string password) => password ?? string.Empty;

    public bool Verify(string password, string hash)
    {
        password = (password ?? string.Empty).Trim();
        hash = (hash ?? string.Empty).Trim();
        return string.Equals(password, hash, StringComparison.Ordinal);
    }
}
