namespace Infrastructure.Identity;

public interface IPasswordHasher
{
    /// <summary>Lưu vào cột password_hash (plain).</summary>
    string Hash(string password);
    bool Verify(string password, string hash);
}

/// <summary>Mật khẩu lưu và so khớp dạng plain text trong DB (không hash).</summary>
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
