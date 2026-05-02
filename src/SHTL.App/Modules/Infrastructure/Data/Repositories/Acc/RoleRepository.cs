using SHTL.Modules.Core.Domain.Entities.Acc;
using Dapper;
using SHTL.Modules.Infrastructure.Persistence;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Acc;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(int id);
    Task<Role?> GetByCodeAsync(string code);
    Task<IEnumerable<Role>> GetAllAsync();
    Task<long> InsertAsync(Role role);
    Task<int> UpdateAsync(Role role);
    Task<int> DeleteAsync(int id);
    Task SavePermissionsAsync(int roleId, List<string> permissions);
}

public class RoleRepository : BaseRepository, IRoleRepository
{
    public RoleRepository(AppDbContext db) : base(db) { }

    public async Task<Role?> GetByIdAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<Role>(conn,
            "SELECT * FROM dbo.acc_roles WHERE id = @Id", new { Id = id });
    }

    public async Task<Role?> GetByCodeAsync(string code)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<Role>(conn,
            "SELECT TOP 1 * FROM dbo.acc_roles WHERE UPPER(code) = UPPER(@Code)",
            new { Code = code });
    }

    public async Task<IEnumerable<Role>> GetAllAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<Role>(conn,
            "SELECT * FROM dbo.acc_roles ORDER BY name");
    }

    public async Task<long> InsertAsync(Role role)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteScalarAsync<long>(conn, @"
            INSERT INTO dbo.acc_roles (name, code, [description], is_active, created, created_by)
            OUTPUT INSERTED.id
            VALUES (@Name, @Code, @Description, @IsActive, @Created, @CreatedBy)", role);
    }

    public async Task<int> UpdateAsync(Role role)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.acc_roles SET name = @Name, code = @Code, [description] = @Description,
                is_active = @IsActive, updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id", role);
    }

    public async Task<int> DeleteAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, "DELETE FROM dbo.acc_roles WHERE id = @Id", new { Id = id });
    }

    public async Task SavePermissionsAsync(int roleId, List<string> permissions)
    {
        var conn = await OpenConnectionAsync();
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            await ExecuteAsync(conn,
                "DELETE FROM dbo.acc_role_permissions WHERE role_id = @RoleId",
                new { RoleId = roleId }, tx);

            foreach (var perm in permissions.Distinct())
            {
                await ExecuteAsync(conn,
                    "INSERT INTO dbo.acc_role_permissions (role_id, permission_code) VALUES (@RoleId, @Perm)",
                    new { RoleId = roleId, Perm = perm }, tx);
            }

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
