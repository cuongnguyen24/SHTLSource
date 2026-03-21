using Dapper;
using System.Data;

namespace Infrastructure.Data.Repositories;

/// <summary>
/// Base repository dùng Dapper — thin wrapper.
/// Mỗi repository con truyền vào IDbConnection tương ứng.
/// </summary>
public abstract class BaseRepository
{
    protected readonly IDbConnectionFactory _factory;

    protected BaseRepository(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    protected async Task<T?> QueryFirstOrDefaultAsync<T>(IDbConnection conn, string sql, object? param = null)
    {
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    protected async Task<IEnumerable<T>> QueryAsync<T>(IDbConnection conn, string sql, object? param = null)
    {
        return await conn.QueryAsync<T>(sql, param);
    }

    protected async Task<T?> ExecuteScalarAsync<T>(IDbConnection conn, string sql, object? param = null)
    {
        return await conn.ExecuteScalarAsync<T>(sql, param);
    }

    protected async Task<int> ExecuteAsync(IDbConnection conn, string sql, object? param = null, IDbTransaction? tx = null)
    {
        return await conn.ExecuteAsync(sql, param, tx);
    }

    /// <summary>Pagination helper — T-SQL OFFSET/FETCH (cần ORDER BY trong câu sql).</summary>
    protected static string WithPaging(string sql, int pageIndex, int pageSize)
    {
        var offset = (pageIndex - 1) * pageSize;
        return $"{sql} OFFSET {offset} ROWS FETCH NEXT {pageSize} ROWS ONLY";
    }

    protected static string CountSql(string fromAndWhere)
        => $"SELECT COUNT(1) FROM {fromAndWhere}";
}
