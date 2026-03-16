using System.Data;
using Npgsql;

namespace Infrastructure.Data;

/// <summary>
/// Tạo connection riêng cho từng database (bounded context).
/// Không dùng DI container để tránh ambiguous — inject IDbConnectionFactory.
/// </summary>
public interface IDbConnectionFactory
{
    IDbConnection CreateAccConnection();
    IDbConnection CreateCnfConnection();
    IDbConnection CreateStgConnection();
    IDbConnection CreateLogConnection();
    IDbConnection CreateMsgConnection();
    IDbConnection CreateCatalogConnection();
}

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly DbConnectionOptions _options;

    public DbConnectionFactory(DbConnectionOptions options)
    {
        _options = options;
    }

    public IDbConnection CreateAccConnection()
        => new NpgsqlConnection(_options.CoreAcc);

    public IDbConnection CreateCnfConnection()
        => new NpgsqlConnection(_options.CoreCnf);

    public IDbConnection CreateStgConnection()
        => new NpgsqlConnection(_options.CoreStg);

    public IDbConnection CreateLogConnection()
        => new NpgsqlConnection(_options.CoreLog);

    public IDbConnection CreateMsgConnection()
        => new NpgsqlConnection(_options.CoreMsg);

    public IDbConnection CreateCatalogConnection()
        => new NpgsqlConnection(_options.CoreCatalog);
}

public class DbConnectionOptions
{
    public string CoreAcc { get; set; } = string.Empty;
    public string CoreCnf { get; set; } = string.Empty;
    public string CoreStg { get; set; } = string.Empty;
    public string CoreLog { get; set; } = string.Empty;
    public string CoreMsg { get; set; } = string.Empty;
    public string CoreCatalog { get; set; } = string.Empty;
}
