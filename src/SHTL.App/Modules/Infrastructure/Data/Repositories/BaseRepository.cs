using Dapper;
using System.Data;

namespace SHTL.Modules.Infrastructure.Data.Repositories;

/// <summary>Shared access to the single <see cref="AppDbContext"/> connection for Dapper-based repositories.</summary>
public abstract class BaseRepository
{
    protected readonly AppDbContext Db;

    protected BaseRepository(AppDbContext db)
    {
        Db = db;
    }

    protected Task<System.Data.Common.DbConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
        => Db.GetOpenConnectionAsync(cancellationToken);

    protected static async Task<T?> QueryFirstOrDefaultAsync<T>(IDbConnection conn, string sql, object? param = null)
        => await conn.QueryFirstOrDefaultAsync<T>(sql, param);

    protected static async Task<IEnumerable<T>> QueryAsync<T>(IDbConnection conn, string sql, object? param = null)
        => await conn.QueryAsync<T>(sql, param);

    protected static async Task<T?> ExecuteScalarAsync<T>(IDbConnection conn, string sql, object? param = null)
        => await conn.ExecuteScalarAsync<T>(sql, param);

    protected static async Task<int> ExecuteAsync(IDbConnection conn, string sql, object? param = null, IDbTransaction? tx = null)
        => await conn.ExecuteAsync(sql, param, tx);

    /// <summary>T-SQL OFFSET/FETCH (requires ORDER BY in <paramref name="sql"/>).</summary>
    protected static string WithPaging(string sql, int pageIndex, int pageSize)
    {
        var offset = (pageIndex - 1) * pageSize;
        return $"{sql} OFFSET {offset} ROWS FETCH NEXT {pageSize} ROWS ONLY";
    }
}
