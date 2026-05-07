using SHTL.Modules.Core.Domain.Entities.Stg;

namespace SHTL.Modules.Core.Domain.Contracts;

/// <summary>Repository cho ExportType (dbo.cnf_export_types — một bản ghi toàn cục).</summary>
public interface IExportTypeRepository : IRepository<ExportType>
{
    Task<IEnumerable<ExportType>> GetListedAsync(bool activeOnly = true);

    Task<ExportType?> GetByCodeAsync(string code);

    Task<bool> IsCodeExistsAsync(string code, int? excludeId = null);

    Task<IEnumerable<ExportType>> SearchAsync(string searchTerm);
}
