using Core.Domain.Entities.Acc;
using Dapper;

namespace Infrastructure.Data.Repositories.Acc;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByUserNameAsync(string userName);
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetListAsync(int channelId, int pageIndex = 1, int pageSize = 20, string? search = null);
    Task<long> CountAsync(int channelId, string? search = null);
    Task<int> InsertAsync(User user);
    Task<int> UpdateAsync(User user);
    Task<int> SetActiveAsync(int id, bool isActive, int updatedBy);
    Task<IEnumerable<User>> GetByChannelAsync(int channelId);
}

public class UserRepository : BaseRepository, IUserRepository
{
    /// <summary>
    /// Dapper không map snake_case → PascalCase; phải AS rõ để password_hash vào PasswordHash.
    /// </summary>
    private const string UserColumns = @"
        id AS Id,
        channel_id AS ChannelId,
        user_name AS UserName,
        email AS Email,
        full_name AS FullName,
        password_hash AS PasswordHash,
        password_salt AS PasswordSalt,
        dept_id AS DeptId,
        position_id AS PositionId,
        is_active AS IsActive,
        is_admin AS IsAdmin,
        avatar AS Avatar,
        phone AS Phone,
        last_login AS LastLogin,
        weight AS Weight,
        search_meta AS SearchMeta,
        created AS Created,
        created_by AS CreatedBy,
        updated AS Updated,
        updated_by AS UpdatedBy";

    public UserRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<User?> GetByIdAsync(int id)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<User>(conn,
            $"SELECT {UserColumns} FROM core_acc.users WHERE id = @Id", new { Id = id });
    }

    public async Task<User?> GetByUserNameAsync(string userName)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<User>(conn,
            $"SELECT TOP 1 {UserColumns} FROM core_acc.users WHERE LOWER(user_name) = LOWER(@UserName)",
            new { UserName = userName });
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryFirstOrDefaultAsync<User>(conn,
            $"SELECT TOP 1 {UserColumns} FROM core_acc.users WHERE LOWER(email) = LOWER(@Email)",
            new { Email = email });
    }

    public async Task<IEnumerable<User>> GetListAsync(int channelId, int pageIndex = 1, int pageSize = 20, string? search = null)
    {
        using var conn = _factory.CreateAccConnection();
        var where = "WHERE channel_id = @ChannelId";
        if (!string.IsNullOrWhiteSpace(search))
            where += " AND (search_meta LIKE @Search OR full_name LIKE @Search OR user_name LIKE @Search)";

        var sql = WithPaging($"SELECT {UserColumns} FROM core_acc.users {where} ORDER BY weight, full_name", pageIndex, pageSize);
        return await QueryAsync<User>(conn, sql, new { ChannelId = channelId, Search = $"%{search}%" });
    }

    public async Task<long> CountAsync(int channelId, string? search = null)
    {
        using var conn = _factory.CreateAccConnection();
        var where = "WHERE channel_id = @ChannelId";
        if (!string.IsNullOrWhiteSpace(search))
            where += " AND (search_meta LIKE @Search OR full_name LIKE @Search OR user_name LIKE @Search)";

        return await ExecuteScalarAsync<long>(conn,
            $"SELECT COUNT(1) FROM core_acc.users {where}",
            new { ChannelId = channelId, Search = $"%{search}%" });
    }

    public async Task<int> InsertAsync(User user)
    {
        using var conn = _factory.CreateAccConnection();
        var sql = @"
            INSERT INTO core_acc.users 
                (channel_id, user_name, email, full_name, password_hash, password_salt,
                 dept_id, position_id, is_active, is_admin, avatar, phone, weight,
                 search_meta, created, created_by)
            OUTPUT INSERTED.id
            VALUES 
                (@ChannelId, @UserName, @Email, @FullName, @PasswordHash, @PasswordSalt,
                 @DeptId, @PositionId, @IsActive, @IsAdmin, @Avatar, @Phone, @Weight,
                 @SearchMeta, @Created, @CreatedBy)";
        return await ExecuteScalarAsync<int>(conn, sql, user);
    }

    public async Task<int> UpdateAsync(User user)
    {
        using var conn = _factory.CreateAccConnection();
        var sql = @"
            UPDATE core_acc.users SET
                full_name = @FullName, email = @Email, dept_id = @DeptId,
                position_id = @PositionId, is_active = @IsActive, is_admin = @IsAdmin,
                avatar = @Avatar, phone = @Phone, weight = @Weight,
                search_meta = @SearchMeta, updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id";
        return await ExecuteAsync(conn, sql, user);
    }

    public async Task<int> SetActiveAsync(int id, bool isActive, int updatedBy)
    {
        using var conn = _factory.CreateAccConnection();
        return await ExecuteAsync(conn,
            "UPDATE core_acc.users SET is_active = @IsActive, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { Id = id, IsActive = isActive, UpdatedBy = updatedBy });
    }

    public async Task<IEnumerable<User>> GetByChannelAsync(int channelId)
    {
        using var conn = _factory.CreateAccConnection();
        return await QueryAsync<User>(conn,
            $"SELECT {UserColumns} FROM core_acc.users WHERE channel_id = @ChannelId AND is_active = 1 ORDER BY full_name",
            new { ChannelId = channelId });
    }
}
