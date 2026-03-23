namespace Core.Domain.Contracts;

/// <summary>Generic repository contract - dùng Dapper bên dưới</summary>
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(long id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<long> InsertAsync(T entity);
    Task<int> UpdateAsync(T entity);
    Task<int> DeleteAsync(long id);
}

/// <summary>Unit of Work - quản lý transaction</summary>
public interface IUnitOfWork : IDisposable
{
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
}

/// <summary>Current user context</summary>
public interface ICurrentUser
{
    int Id { get; }
    int ChannelId { get; }
    string UserName { get; }
    string FullName { get; }
    bool IsAdmin { get; }
    IEnumerable<string> Roles { get; }
    bool HasPermission(string module);
}

/// <summary>Storage abstraction</summary>
public interface IStorageService
{
    Task<string> SaveFileAsync(Stream stream, string fileName, string subPath);
    Task<Stream?> GetFileAsync(string path);
    /// <summary>Đọc trực tiếp từ đĩa (ưu tiên cho phát PDF có Range). Null nếu không tồn tại hoặc path không hợp lệ.</summary>
    Stream? OpenRead(string relativePath);
    Task<bool> DeleteFileAsync(string path);
    Task<string> GetPublicUrlAsync(string path);
    Task<string?> SaveThumbnailAsync(string sourcePath, string thumbPath);
}
