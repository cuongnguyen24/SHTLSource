using Core.Domain.Entities.Stg;

namespace Core.Domain.Contracts;

/// <summary>Repository cho ExportType</summary>
public interface IExportTypeRepository : IRepository<ExportType>
{
    /// <summary>Lấy danh sách ExportType theo channel</summary>
    Task<IEnumerable<ExportType>> GetByChannelAsync(int channelId, bool activeOnly = true);
    
    /// <summary>Lấy ExportType theo Code</summary>
    Task<ExportType?> GetByCodeAsync(int channelId, string code);
    
    /// <summary>Kiểm tra Code đã tồn tại chưa</summary>
    Task<bool> IsCodeExistsAsync(int channelId, string code, int? excludeId = null);
    
    /// <summary>Search ExportType</summary>
    Task<IEnumerable<ExportType>> SearchAsync(int channelId, string searchTerm);
}
