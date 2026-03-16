using Core.Domain.Entities.Acc;
using Dapper;

namespace Infrastructure.Data.Repositories.Acc;

public interface IDeptRepository
{
    Task<Dept?> GetByIdAsync(int id);
    Task<IEnumerable<Dept>> GetByChannelAsync(int channelId);
    Task<long> InsertAsync(Dept dept);
    Task<int> UpdateAsync(Dept dept);
    Task<int> DeleteAsync(int id);
}

public class DeptRepository : BaseRepository, IDeptRepository
{
    public DeptRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<Dept?> GetByIdAsync(int id)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<Dept>(conn,
            "SELECT * FROM core_acc.depts WHERE id = @Id", new { Id = id });
    }

    public async Task<IEnumerable<Dept>> GetByChannelAsync(int channelId)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryAsync<Dept>(conn,
            "SELECT * FROM core_acc.depts WHERE channel_id = @ChannelId ORDER BY weight, name",
            new { ChannelId = channelId });
    }

    public async Task<long> InsertAsync(Dept dept)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteScalarAsync<long>(conn, @"
            INSERT INTO core_acc.depts (channel_id, name, code, describe, parent, parents, weight, created, created_by)
            VALUES (@ChannelId, @Name, @Code, @Describe, @Parent, @Parents, @Weight, @Created, @CreatedBy)
            RETURNING id", dept);
    }

    public async Task<int> UpdateAsync(Dept dept)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteAsync(conn, @"
            UPDATE core_acc.depts SET name = @Name, code = @Code, describe = @Describe,
                parent = @Parent, parents = @Parents, weight = @Weight,
                updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id", dept);
    }

    public async Task<int> DeleteAsync(int id)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteAsync(conn, "DELETE FROM core_acc.depts WHERE id = @Id", new { Id = id });
    }
}
