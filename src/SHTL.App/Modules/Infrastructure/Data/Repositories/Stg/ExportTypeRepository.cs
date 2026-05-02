using Microsoft.EntityFrameworkCore;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public class ExportTypeRepository : IExportTypeRepository
{
    private readonly AppDbContext _db;

    public ExportTypeRepository(AppDbContext db)
    {
        _db = db;
    }

    public Task<ExportType?> GetByIdAsync(long id)
        => _db.ExportTypes.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);

    public async Task<IEnumerable<ExportType>> GetAllAsync()
        => await _db.ExportTypes.AsNoTracking().OrderByDescending(e => e.Created).ToListAsync();

    public async Task<long> InsertAsync(ExportType entity)
    {
        _db.ExportTypes.Add(entity);
        await _db.SaveChangesAsync();
        return entity.Id;
    }

    public async Task<int> UpdateAsync(ExportType entity)
    {
        _db.ExportTypes.Update(entity);
        return await _db.SaveChangesAsync();
    }

    public async Task<int> DeleteAsync(long id)
        => await _db.ExportTypes.Where(e => e.Id == id).ExecuteDeleteAsync();

    public async Task<IEnumerable<ExportType>> GetListedAsync(bool activeOnly = true)
    {
        var q = _db.ExportTypes.AsNoTracking().AsQueryable();
        if (activeOnly)
            q = q.Where(e => e.IsActive);
        return await q.OrderByDescending(e => e.Created).ToListAsync();
    }

    public Task<ExportType?> GetByCodeAsync(string code)
        => _db.ExportTypes.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Code == code);

    public async Task<bool> IsCodeExistsAsync(string code, int? excludeId = null)
    {
        var q = _db.ExportTypes.AsNoTracking().Where(e => e.Code == code);
        if (excludeId.HasValue)
            q = q.Where(e => e.Id != excludeId.Value);
        return await q.AnyAsync();
    }

    public async Task<IEnumerable<ExportType>> SearchAsync(string searchTerm)
    {
        var term = $"%{searchTerm}%";
        return await _db.ExportTypes.AsNoTracking()
            .Where(e =>
                EF.Functions.Like(e.Name, term) ||
                EF.Functions.Like(e.Code, term) ||
                (e.Description != null && EF.Functions.Like(e.Description, term)) ||
                (e.SearchMeta != null && EF.Functions.Like(e.SearchMeta, term)))
            .OrderByDescending(e => e.Created)
            .ToListAsync();
    }
}
