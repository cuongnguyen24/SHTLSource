using SHTL.Modules.Core.Domain.Entities.Acc;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Acc;

public interface IDeptRepository
{
    Task<Dept?> GetByIdAsync(int id);
    Task<IEnumerable<Dept>> GetAllAsync();
    Task<long> InsertAsync(Dept dept);
    Task<int> UpdateAsync(Dept dept);
    Task<int> DeleteAsync(int id);
}

public class DeptRepository : BaseRepository, IDeptRepository
{
    public DeptRepository(AppDbContext db) : base(db) { }

    public async Task<Dept?> GetByIdAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<Dept>(conn,
            "SELECT * FROM dbo.acc_depts WHERE id = @Id", new { Id = id });
    }

    public async Task<IEnumerable<Dept>> GetAllAsync()
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<Dept>(conn,
            "SELECT * FROM dbo.acc_depts ORDER BY weight, name");
    }

    public async Task<long> InsertAsync(Dept dept)
    {
        var conn = await OpenConnectionAsync();
        // updated_by là NOT NULL trong migration — bản ghi mới: chưa cập nhật, dùng 0 (khớp default entity).
        return await ExecuteScalarAsync<long>(conn, @"
            INSERT INTO dbo.acc_depts (name, code, [describe], parent, parent_id, parents, weight, created, created_by, updated, updated_by)
            OUTPUT INSERTED.id
            VALUES (@Name, @Code, @Describe, @Parent, @ParentId, @Parents, @Weight, @Created, @CreatedBy, @Updated, @UpdatedBy)", dept);
    }

    public async Task<int> UpdateAsync(Dept dept)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
            UPDATE dbo.acc_depts SET name = @Name, code = @Code, [describe] = @Describe,
                parent = @Parent, parent_id = @ParentId, parents = @Parents, weight = @Weight,
                updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id", dept);
    }

    public async Task<int> DeleteAsync(int id)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, "DELETE FROM dbo.acc_depts WHERE id = @Id", new { Id = id });
    }
}
