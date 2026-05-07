using Microsoft.EntityFrameworkCore;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Persistence;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Acc;

public interface IUserRepository
{
    Task<IReadOnlyList<string>> GetPermissionCodesForUserAsync(int userId, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByUserNameAsync(string userName);
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetListAsync(int pageIndex = 1, int pageSize = 20, string? search = null);
    Task<long> CountAsync(string? search = null);
    Task<int> InsertAsync(User user);
    Task<int> UpdateAsync(User user);
    Task<int> SetActiveAsync(int id, bool isActive, int updatedBy);
    Task<int> SetPasswordHashAsync(int id, string passwordHash, int updatedBy);
    Task<IEnumerable<User>> GetActiveUsersAsync();
}

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public UserRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<string>> GetPermissionCodesForUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        if (userId <= 0) return Array.Empty<string>();
        return await (
                from ur in _db.UserRoles.AsNoTracking()
                join rp in _db.AccRolePermissions.AsNoTracking() on ur.RoleId equals rp.RoleId
                where ur.UserId == userId
                select rp.PermissionCode)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public Task<User?> GetByIdAsync(int id)
        => _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByUserNameAsync(string userName)
    {
        var n = (userName ?? string.Empty).Trim();
        return _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName.ToLower() == n.ToLower());
    }

    public Task<User?> GetByEmailAsync(string email)
    {
        var e = (email ?? string.Empty).Trim();
        return _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == e.ToLower());
    }

    public async Task<IEnumerable<User>> GetListAsync(int pageIndex = 1, int pageSize = 20, string? search = null)
    {
        var q = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = $"%{search}%";
            q = q.Where(u =>
                (u.SearchMeta != null && EF.Functions.Like(u.SearchMeta, s)) ||
                EF.Functions.Like(u.FullName, s) ||
                EF.Functions.Like(u.UserName, s));
        }

        return await q.OrderBy(u => u.Weight).ThenBy(u => u.FullName)
            .Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public async Task<long> CountAsync(string? search = null)
    {
        var q = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = $"%{search}%";
            q = q.Where(u =>
                (u.SearchMeta != null && EF.Functions.Like(u.SearchMeta, s)) ||
                EF.Functions.Like(u.FullName, s) ||
                EF.Functions.Like(u.UserName, s));
        }

        return await q.LongCountAsync();
    }

    public async Task<int> InsertAsync(User user)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user.Id;
    }

    public async Task<int> UpdateAsync(User user)
    {
        _db.Users.Update(user);
        return await _db.SaveChangesAsync();
    }

    public async Task<int> SetActiveAsync(int id, bool isActive, int updatedBy)
    {
        var rows = await _db.Users.Where(u => u.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.IsActive, isActive)
                .SetProperty(u => u.Updated, DateTime.UtcNow)
                .SetProperty(u => u.UpdatedBy, updatedBy));
        return rows;
    }

    public async Task<int> SetPasswordHashAsync(int id, string passwordHash, int updatedBy)
    {
        var rows = await _db.Users.Where(u => u.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.PasswordHash, passwordHash)
                .SetProperty(u => u.Updated, DateTime.UtcNow)
                .SetProperty(u => u.UpdatedBy, updatedBy));
        return rows;
    }

    public async Task<IEnumerable<User>> GetActiveUsersAsync()
        => await _db.Users.AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.FullName)
            .ToListAsync();
}
