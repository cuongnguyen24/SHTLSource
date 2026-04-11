# Reference Cache — SHTL Code Patterns

> **Version:** 1.0 | **Date:** 12/04/2026
> **Purpose:** Cached code patterns from SHTL codebase for quick reference

---

## 1. ENTITY PATTERNS

### 1.1 Base Entity

```csharp
// Core.Domain/Entities/BaseEntity.cs
public abstract class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
}
```

### 1.2 Simple Entity Example

```csharp
// Core.Domain/Entities/Cnf/Channel.cs
namespace Core.Domain.Entities.Cnf;

public class Channel : BaseEntity
{
    public string ChannelCode { get; set; } = string.Empty;
    public string ChannelName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}
```

### 1.3 Complex Entity Example (Document)

```csharp
// Core.Domain/Entities/Stg/Document.cs
namespace Core.Domain.Entities.Stg;

public class Document : BaseEntity
{
    // Core fields
    public int ChannelId { get; set; }
    public int? FolderId { get; set; }
    public string DocumentCode { get; set; } = string.Empty;
    public int? DocTypeId { get; set; }
    public int? RecordTypeId { get; set; }
    public int? SyncTypeId { get; set; }
    
    // File info
    public string? StoredPath { get; set; }
    public string? OriginalFileName { get; set; }
    public long? FileSize { get; set; }
    public string? Extension { get; set; }
    public string? PublicUrl { get; set; }
    
    // Workflow
    public WorkflowStep CurrentStep { get; set; }
    public bool IsCheckScan1Done { get; set; }
    public bool IsCheckScan2Done { get; set; }
    public bool IsZoningDone { get; set; }
    public bool IsOcrDone { get; set; }
    public bool IsExtractDone { get; set; }
    public bool IsCheck1Done { get; set; }
    public bool IsCheck2Done { get; set; }
    public bool IsCheckFinalDone { get; set; }
    public bool IsCheckLogicDone { get; set; }
    public bool IsExportDone { get; set; }
    
    // Dynamic fields (20 fields)
    public string? Field01 { get; set; }
    public string? Field02 { get; set; }
    public string? Field03 { get; set; }
    // ... Field04 to Field20
}
```

---

## 2. REPOSITORY PATTERNS

### 2.1 Repository Interface

```csharp
// Core.Domain/Contracts/IRepository.cs
namespace Core.Domain.Contracts;

public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<int> InsertAsync(T entity);
    Task<bool> UpdateAsync(T entity);
    Task<bool> DeleteAsync(int id);
}
```

### 2.2 Repository Implementation (Dapper)

```csharp
// Infrastructure.Data/Repositories/StgRepository.cs
namespace Infrastructure.Data.Repositories;

public class StgRepository : IRepository<Document>
{
    private readonly IDbConnectionFactory _connectionFactory;
    
    public StgRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }
    
    public async Task<Document?> GetByIdAsync(int id)
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        return await conn.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM core_stg.documents WHERE Id = @Id AND IsDeleted = 0",
            new { Id = id });
    }
    
    public async Task<IEnumerable<Document>> GetAllAsync()
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        return await conn.QueryAsync<Document>(
            "SELECT * FROM core_stg.documents WHERE IsDeleted = 0 ORDER BY CreatedAt DESC");
    }
    
    public async Task<int> InsertAsync(Document entity)
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        entity.CreatedAt = DateTime.UtcNow;
        entity.IsDeleted = false;
        
        var sql = @"
            INSERT INTO core_stg.documents 
            (ChannelId, DocumentCode, StoredPath, CurrentStep, CreatedAt, CreatedBy, IsDeleted)
            VALUES (@ChannelId, @DocumentCode, @StoredPath, @CurrentStep, @CreatedAt, @CreatedBy, @IsDeleted);
            SELECT CAST(SCOPE_IDENTITY() as int);";
        
        return await conn.ExecuteScalarAsync<int>(sql, entity);
    }
    
    public async Task<bool> UpdateAsync(Document entity)
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        entity.UpdatedAt = DateTime.UtcNow;
        
        var sql = @"
            UPDATE core_stg.documents 
            SET ChannelId = @ChannelId,
                DocumentCode = @DocumentCode,
                StoredPath = @StoredPath,
                CurrentStep = @CurrentStep,
                UpdatedAt = @UpdatedAt,
                UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        
        var affected = await conn.ExecuteAsync(sql, entity);
        return affected > 0;
    }
    
    public async Task<bool> DeleteAsync(int id)
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        
        var sql = @"
            UPDATE core_stg.documents 
            SET IsDeleted = 1, UpdatedAt = @UpdatedAt
            WHERE Id = @Id";
        
        var affected = await conn.ExecuteAsync(sql, new 
        { 
            Id = id,
            UpdatedAt = DateTime.UtcNow
        });
        
        return affected > 0;
    }
}
```

### 2.3 Pagination Pattern

```csharp
public async Task<PaginatedResult<Document>> GetPagedAsync(
    int channelId, 
    int page, 
    int pageSize)
{
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    
    var countSql = @"
        SELECT COUNT(*) 
        FROM core_stg.documents 
        WHERE ChannelId = @ChannelId AND IsDeleted = 0";
    
    var total = await conn.ExecuteScalarAsync<int>(countSql, new { ChannelId = channelId });
    
    var dataSql = @"
        SELECT * 
        FROM core_stg.documents 
        WHERE ChannelId = @ChannelId AND IsDeleted = 0
        ORDER BY CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
    
    var items = await conn.QueryAsync<Document>(dataSql, new 
    { 
        ChannelId = channelId,
        Offset = (page - 1) * pageSize,
        PageSize = pageSize
    });
    
    return new PaginatedResult<Document>
    {
        Items = items.ToList(),
        TotalCount = total,
        Page = page,
        PageSize = pageSize
    };
}
```

---

## 3. DTO PATTERNS

### 3.1 Response DTO

```csharp
// Shared.Contracts/DocumentDto.cs
namespace Shared.Contracts;

public class DocumentDto
{
    public int Id { get; set; }
    public string DocumentCode { get; set; } = string.Empty;
    public string? OriginalFileName { get; set; }
    public WorkflowStep CurrentStep { get; set; }
    public string CurrentStepText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string CreatedAtText { get; set; } = string.Empty;
}
```

### 3.2 Request DTOs

```csharp
// Shared.Contracts/CreateDocumentRequest.cs
namespace Shared.Contracts;

public class CreateDocumentRequest
{
    [Required(ErrorMessage = "Kênh là bắt buộc")]
    public int ChannelId { get; set; }
    
    [Required(ErrorMessage = "Mã tài liệu là bắt buộc")]
    [MaxLength(50, ErrorMessage = "Mã tài liệu tối đa 50 ký tự")]
    public string DocumentCode { get; set; } = string.Empty;
    
    public string? StoredPath { get; set; }
}

// Shared.Contracts/UpdateDocumentRequest.cs
public class UpdateDocumentRequest
{
    [Required]
    public int Id { get; set; }
    
    [Required(ErrorMessage = "Mã tài liệu là bắt buộc")]
    [MaxLength(50)]
    public string DocumentCode { get; set; } = string.Empty;
    
    public WorkflowStep CurrentStep { get; set; }
}
```

### 3.3 PaginatedResult

```csharp
// Shared.Contracts/PaginatedResult.cs
namespace Shared.Contracts;

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}
```

---

## 4. SERVICE PATTERNS

### 4.1 Service Implementation

```csharp
// Core.Application/Services/DocumentService.cs
namespace Core.Application.Services;

public class DocumentService
{
    private readonly IRepository<Document> _documentRepo;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<DocumentService> _logger;
    
    public DocumentService(
        IRepository<Document> documentRepo,
        ICurrentUser currentUser,
        ILogger<DocumentService> logger)
    {
        _documentRepo = documentRepo;
        _currentUser = currentUser;
        _logger = logger;
    }
    
    public async Task<ServiceResult<int>> CreateAsync(CreateDocumentRequest request)
    {
        try
        {
            var document = new Document
            {
                ChannelId = request.ChannelId,
                DocumentCode = request.DocumentCode,
                StoredPath = request.StoredPath,
                CurrentStep = WorkflowStep.Scan,
                CreatedBy = _currentUser.UserId
            };
            
            var id = await _documentRepo.InsertAsync(document);
            
            _logger.LogInformation("Document created: {DocumentCode}, ID: {Id}", 
                request.DocumentCode, id);
            
            return ServiceResult<int>.Success(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create document: {DocumentCode}", 
                request.DocumentCode);
            return ServiceResult<int>.Failure("Tạo tài liệu thất bại");
        }
    }
    
    public async Task<DocumentDto?> GetByIdAsync(int id)
    {
        var document = await _documentRepo.GetByIdAsync(id);
        return document == null ? null : MapToDto(document);
    }
    
    public async Task<PaginatedResult<DocumentDto>> GetPagedAsync(
        int channelId, 
        int page, 
        int pageSize)
    {
        var result = await _documentRepo.GetPagedAsync(channelId, page, pageSize);
        
        return new PaginatedResult<DocumentDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize
        };
    }
    
    public async Task<ServiceResult> UpdateAsync(UpdateDocumentRequest request)
    {
        try
        {
            var document = await _documentRepo.GetByIdAsync(request.Id);
            if (document == null)
                return ServiceResult.Failure("Không tìm thấy tài liệu");
            
            document.DocumentCode = request.DocumentCode;
            document.CurrentStep = request.CurrentStep;
            document.UpdatedBy = _currentUser.UserId;
            
            await _documentRepo.UpdateAsync(document);
            
            return ServiceResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update document: {Id}", request.Id);
            return ServiceResult.Failure("Cập nhật thất bại");
        }
    }
    
    public async Task<ServiceResult> DeleteAsync(int id)
    {
        try
        {
            var success = await _documentRepo.DeleteAsync(id);
            return success 
                ? ServiceResult.Success() 
                : ServiceResult.Failure("Không tìm thấy tài liệu");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete document: {Id}", id);
            return ServiceResult.Failure("Xóa thất bại");
        }
    }
    
    private DocumentDto MapToDto(Document doc) => new()
    {
        Id = doc.Id,
        DocumentCode = doc.DocumentCode,
        OriginalFileName = doc.OriginalFileName,
        CurrentStep = doc.CurrentStep,
        CurrentStepText = GetStepText(doc.CurrentStep),
        CreatedAt = doc.CreatedAt,
        CreatedAtText = doc.CreatedAt.ToString("dd/MM/yyyy HH:mm")
    };
    
    private string GetStepText(WorkflowStep step) => step switch
    {
        WorkflowStep.Scan => "Scan",
        WorkflowStep.CheckScan1 => "Kiểm tra Scan 1",
        WorkflowStep.CheckScan2 => "Kiểm tra Scan 2",
        WorkflowStep.Extract => "Nhập liệu",
        WorkflowStep.Done => "Hoàn thành",
        _ => step.ToString()
    };
}
```

### 4.2 ServiceResult Pattern

```csharp
// Shared.Contracts/ServiceResult.cs
namespace Shared.Contracts;

public class ServiceResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<string> Errors { get; set; } = new();
    
    public static ServiceResult Success() => new() { Success = true };
    
    public static ServiceResult Failure(string error) => new()
    {
        Success = false,
        ErrorMessage = error
    };
}

public class ServiceResult<T> : ServiceResult
{
    public T? Data { get; set; }
    
    public static ServiceResult<T> Success(T data) => new()
    {
        Success = true,
        Data = data
    };
    
    public new static ServiceResult<T> Failure(string error) => new()
    {
        Success = false,
        ErrorMessage = error
    };
}
```

---

## 5. CONTROLLER PATTERNS

### 5.1 Full Controller Example

```csharp
// Web.SoHoa/Controllers/DocumentController.cs
namespace Web.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode = "DOC_SCAN")]
public class DocumentController : Controller
{
    private readonly DocumentService _documentService;
    private readonly ICurrentUser _currentUser;
    
    public DocumentController(
        DocumentService documentService,
        ICurrentUser currentUser)
    {
        _documentService = documentService;
        _currentUser = currentUser;
    }
    
    [HttpGet]
    public async Task<IActionResult> Index(int page = 1, int pageSize = 20)
    {
        var result = await _documentService.GetPagedAsync(
            _currentUser.ChannelId ?? 0, 
            page, 
            pageSize);
        
        return View(result);
    }
    
    [HttpGet]
    public IActionResult Create()
    {
        return View();
    }
    
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateDocumentRequest request)
    {
        if (!ModelState.IsValid)
            return View(request);
        
        request.ChannelId = _currentUser.ChannelId ?? 0;
        
        var result = await _documentService.CreateAsync(request);
        
        if (!result.Success)
        {
            ModelState.AddModelError("", result.ErrorMessage ?? "Lỗi không xác định");
            return View(request);
        }
        
        TempData["SuccessMessage"] = "Tạo tài liệu thành công";
        return RedirectToAction(nameof(Index));
    }
    
    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var document = await _documentService.GetByIdAsync(id);
        if (document == null)
            return NotFound();
        
        var request = new UpdateDocumentRequest
        {
            Id = document.Id,
            DocumentCode = document.DocumentCode,
            CurrentStep = document.CurrentStep
        };
        
        return View(request);
    }
    
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(UpdateDocumentRequest request)
    {
        if (!ModelState.IsValid)
            return View(request);
        
        var result = await _documentService.UpdateAsync(request);
        
        if (!result.Success)
        {
            ModelState.AddModelError("", result.ErrorMessage ?? "Lỗi không xác định");
            return View(request);
        }
        
        TempData["SuccessMessage"] = "Cập nhật thành công";
        return RedirectToAction(nameof(Index));
    }
    
    [HttpPost]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _documentService.DeleteAsync(id);
        
        return Json(new 
        { 
            success = result.Success, 
            message = result.Success ? "Xóa thành công" : result.ErrorMessage 
        });
    }
    
    [HttpGet]
    public async Task<IActionResult> Detail(int id)
    {
        var document = await _documentService.GetByIdAsync(id);
        if (document == null)
            return NotFound();
        
        return View(document);
    }
}
```

---

## 6. DI REGISTRATION PATTERNS

### 6.1 Application Services

```csharp
// Core.Application/AppServiceExtensions.cs
namespace Core.Application;

public static class AppServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Document services
        services.AddScoped<DocumentService>();
        services.AddScoped<DocumentWorkflowService>();
        services.AddScoped<DocCatalogService>();
        
        // User management
        services.AddScoped<UserManagementService>();
        services.AddScoped<RoleService>();
        services.AddScoped<DeptService>();
        
        // System services
        services.AddScoped<ConfigService>();
        services.AddScoped<ReportService>();
        services.AddScoped<LogService>();
        services.AddScoped<AuthAppService>();
        
        return services;
    }
}
```

### 6.2 Data Services

```csharp
// Infrastructure.Data/DataServiceExtensions.cs
namespace Infrastructure.Data;

public static class DataServiceExtensions
{
    public static IServiceCollection AddDataServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Connection factory
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        
        // Repositories
        services.AddScoped<IRepository<Document>, StgRepository>();
        services.AddScoped<IRepository<User>, AccRepository>();
        services.AddScoped<IRepository<Role>, AccRepository>();
        services.AddScoped<IRepository<Channel>, CnfRepository>();
        
        return services;
    }
}
```

---

**END OF REFERENCE CACHE**
