using System.Data;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Data;

/// <summary>
/// Tạo connection theo bounded context (mỗi context có thể là một database riêng).
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
        => new SqlConnection(_options.CoreAcc);

    public IDbConnection CreateCnfConnection()
        => new SqlConnection(_options.CoreCnf);

    public IDbConnection CreateStgConnection()
        => new SqlConnection(_options.CoreStg);

    public IDbConnection CreateLogConnection()
        => new SqlConnection(_options.CoreLog);

    public IDbConnection CreateMsgConnection()
        => new SqlConnection(_options.CoreMsg);

    public IDbConnection CreateCatalogConnection()
        => new SqlConnection(_options.CoreCatalog);
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
