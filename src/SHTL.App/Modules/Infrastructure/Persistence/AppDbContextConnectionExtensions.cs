using Microsoft.EntityFrameworkCore;
using System.Data;

namespace SHTL.Modules.Infrastructure.Persistence;

public static class AppDbContextConnectionExtensions
{
    public static async Task<System.Data.Common.DbConnection> GetOpenConnectionAsync(
        this AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(cancellationToken);
        return conn;
    }
}
