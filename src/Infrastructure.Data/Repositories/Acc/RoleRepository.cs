using Core.Domain.Entities.Acc;
using Dapper;

namespace Infrastructure.Data.Repositories.Acc;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(int id);
    Task<Role?> GetByCodeAsync(string code, int channelId);
    Task<IEnumerable<Role>> GetByChannelAsync(int channelId);
    Task<long> InsertAsync(Role role);
    Task<int> UpdateAsync(Role role);
    Task<int> DeleteAsync(int id);
    Task SavePermissionsAsync(int roleId, List<string> permissions, int channelId);
}

public class RoleRepository : BaseRepository, IRoleRepository
{
    public RoleRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<Role?> GetByIdAsync(int id)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<Role>(conn,
            "SELECT * FROM core_acc.roles WHERE id = @Id", new { Id = id });
    }

    public async Task<Role?> GetByCodeAsync(string code, int channelId)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<Role>(conn,
            "SELECT TOP 1 * FROM core_acc.roles WHERE UPPER(code) = UPPER(@Code) AND channel_id = @ChannelId",
            new { Code = code, ChannelId = channelId });
    }

    public async Task<IEnumerable<Role>> GetByChannelAsync(int channelId)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryAsync<Role>(conn,
            "SELECT * FROM core_acc.roles WHERE channel_id = @ChannelId ORDER BY name",
            new { ChannelId = channelId });
    }

    public async Task<long> InsertAsync(Role role)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteScalarAsync<long>(conn, @"
            INSERT INTO core_acc.roles (channel_id, name, code, [description], is_active, created, created_by)
            OUTPUT INSERTED.id
            VALUES (@ChannelId, @Name, @Code, @Description, @IsActive, @Created, @CreatedBy)", role);
    }

    public async Task<int> UpdateAsync(Role role)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteAsync(conn, @"
            UPDATE core_acc.roles SET name = @Name, code = @Code, [description] = @Description,
                is_active = @IsActive, updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id", role);
    }

    public async Task<int> DeleteAsync(int id)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteAsync(conn, "DELETE FROM core_acc.roles WHERE id = @Id", new { Id = id });
    }

    public async Task SavePermissionsAsync(int roleId, List<string> permissions, int channelId)
    {
        using var conn = _factory.CreateAccConnection();
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            await ExecuteAsync(conn,
                "DELETE FROM core_acc.role_permissions WHERE role_id = @RoleId AND channel_id = @ChannelId",
                new { RoleId = roleId, ChannelId = channelId }, tx);

            foreach (var perm in permissions.Distinct())
            {
                await ExecuteAsync(conn,
                    "INSERT INTO core_acc.role_permissions (role_id, channel_id, permission_code) VALUES (@RoleId, @ChannelId, @Perm)",
                    new { RoleId = roleId, ChannelId = channelId, Perm = perm }, tx);
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
