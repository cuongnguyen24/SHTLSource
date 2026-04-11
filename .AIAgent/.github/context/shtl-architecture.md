# SHTL ARCHITECTURE REFERENCE

> **Version:** 1.0 | **Date:** 12/04/2026
> **Purpose:** Architecture patterns, conventions, and technical constraints for SHTL project.

---

## 1. CLEAN ARCHITECTURE OVERVIEW

### 1.1 Layer Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                    Web Layer (MVC)                      │
│  - Web.SoHoa: Workflow số hóa (Scan/Extract/Check)     │
│  - Web.Admin: Quản trị hệ thống (User/Role/Config)     │
│  - Web.Account: Hồ sơ cá nhân (Profile/Login)          │
│  - Web.Dashboard: Dashboard/Báo cáo                     │
│  - Web.Uploader: Upload API (multipart file)           │
│                                                         │
│  Dependencies: Core.Application, Infrastructure.*      │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
┌────────────────────▼────────────────────────────────────┐
│              Application Layer                          │
│  - Core.Application/Services/*Service.cs                │
│    + DocumentService, DocumentWorkflowService           │
│    + UserManagementService, RoleService, DeptService    │
│    + AuthAppService, ConfigService, ReportService       │
│    + LogService, DocCatalogService                      │
│                                                         │
│  Dependencies: Core.Domain, Infrastructure contracts   │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
┌────────────────────▼────────────────────────────────────┐
│                 Domain Layer                            │
│  - Core.Domain/Entities/{Schema}/*.cs                   │
│    + Acc: User, Role, Dept, Team                        │
│    + Cnf: Channel, Config, ContentType, RecordType      │
│    + Stg: Document, DocumentFolder, FormCell            │
│    + Log: AccessLog, ActionLog, ErrorLog                │
│    + Msg: Notification                                  │
│    + Catalog: Province, District, Ward                  │
│                                                         │
│  - Core.Domain/Contracts/I*Repository.cs                │
│  - Core.Domain/Enums/*.cs (WorkflowStep, etc.)         │
│                                                         │
│  Dependencies: NONE (pure domain)                       │
└────────────────────┬────────────────────────────────────┘
                     │ implemented by
┌────────────────────▼────────────────────────────────────┐
│            Infrastructure Layer                         │
│  - Infrastructure.Data: Dapper repositories             │
│    + AccRepository, CnfRepository, StgRepository        │
│    + LogRepository, MsgRepository, CatalogRepository    │
│    + IDbConnectionFactory (multi-DB support)            │
│                                                         │
│  - Infrastructure.Identity: Authentication              │
│    + AuthService, CurrentUser                           │
│    + PlaintextPasswordHasher (⚠️ security concern)      │
│                                                         │
│  - Infrastructure.Storage: File storage                 │
│    + LocalFileStorageService (NAS/local path)           │
│                                                         │
│  - Infrastructure.Search: Elasticsearch                 │
│    + NEST client, document indexing                     │
│                                                         │
│  Dependencies: Core.Domain, external packages           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Dependency Rules (STRICT)

| Layer | Can depend on | CANNOT depend on |
|-------|---------------|------------------|
| **Domain** | Nothing | Application, Infrastructure, Web |
| **Application** | Domain | Infrastructure, Web |
| **Infrastructure** | Domain, Application contracts | Web |
| **Web** | Application, Infrastructure | Nothing (top layer) |

**Violation examples:**
- ❌ Domain references `IDbConnectionFactory` (Infrastructure)
- ❌ Application references `AccRepository` directly (Infrastructure)
- ✅ Application references `IRepository<User>` (Domain contract)
- ✅ Infrastructure implements `IRepository<User>` (Domain contract)

---

## 2. DATABASE ARCHITECTURE

### 2.1 Multi-Database Schema

SHTL uses **6 separate databases** (or schemas in same DB):

| Schema | Purpose | Key Tables | Connection Key |
|--------|---------|------------|----------------|
| **core_acc** | Account & Auth | users, roles, depts, teams, user_roles, role_permissions, user_sessions | `CoreAcc` |
| **core_cnf** | Configuration | channels, configs, content_types, record_types, sync_types, export_types, translations | `CoreCnf` |
| **core_stg** | Document Storage | documents, document_folders, form_cells, ocr_jobs, export_jobs | `CoreStg` |
| **core_log** | Logging | access_logs, action_logs, error_logs | `CoreLog` |
| **core_msg** | Messaging | notifications | `CoreMsg` |
| **core_catalog** | Catalog Data | provinces, districts, wards | `CoreCatalog` |

### 2.2 Connection String Management

**Single source of truth:** `src/Web.Dashboard/config/connectionstrings.json`

```json
{
  "ConnectionStrings": {
    "CoreAcc": "Server=localhost\\SQLEXPRESS;Database=Core_Acc;User Id=sa;Password=***;TrustServerCertificate=True;Encrypt=True;",
    "CoreCnf": "Server=localhost\\SQLEXPRESS;Database=Core_Cnf;...",
    "CoreStg": "Server=localhost\\SQLEXPRESS;Database=Core_Stg;...",
    "CoreLog": "Server=localhost\\SQLEXPRESS;Database=Core_Log;...",
    "CoreMsg": "Server=localhost\\SQLEXPRESS;Database=Core_Msg;...",
    "CoreCatalog": "Server=localhost\\SQLEXPRESS;Database=Core_Catalog;..."
  }
}
```

**Build automation:** `src/Directory.Build.props` copies this file to `config\connectionstrings.json` next to every project's `.dll` during build/publish.

**Loading in Program.cs:**
```csharp
builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"),
                 optional: false, reloadOnChange: true);
```

### 2.3 Repository Pattern (Dapper)

**Interface (Domain):**
```csharp
// Core.Domain/Contracts/IRepository.cs
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<int> InsertAsync(T entity);
    Task<bool> UpdateAsync(T entity);
    Task<bool> DeleteAsync(int id);
}
```

**Implementation (Infrastructure):**
```csharp
// Infrastructure.Data/Repositories/AccRepository.cs
public class AccRepository : IRepository<User>
{
    private readonly IDbConnectionFactory _connectionFactory;
    
    public AccRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }
    
    public async Task<User?> GetByIdAsync(int id)
    {
        using var conn = _connectionFactory.CreateConnection("CoreAcc");
        return await conn.QuerySingleOrDefaultAsync<User>(
            "SELECT * FROM core_acc.users WHERE UserId = @Id", 
            new { Id = id });
    }
}
```

**Connection Factory:**
```csharp
// Infrastructure.Data/IDbConnectionFactory.cs
public interface IDbConnectionFactory
{
    IDbConnection CreateConnection(string connectionKey);
}

// Infrastructure.Data/DbConnectionFactory.cs
public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly IConfiguration _configuration;
    
    public IDbConnection CreateConnection(string connectionKey)
    {
        var connectionString = _configuration.GetConnectionString(connectionKey);
        return new SqlConnection(connectionString);
    }
}
```

---

## 3. ENTITY PATTERNS

### 3.1 Base Entity

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

### 3.2 Domain Entities by Schema

**Acc (Account):**
```csharp
// Core.Domain/Entities/Acc/User.cs
public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public int? ChannelId { get; set; }
    public int? DeptId { get; set; }
    public bool IsActive { get; set; }
    public bool IsAdmin { get; set; }
}

// Core.Domain/Entities/Acc/Role.cs
public class Role : BaseEntity
{
    public string RoleName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ChannelId { get; set; }
}
```

**Stg (Storage/Document):**
```csharp
// Core.Domain/Entities/Stg/Document.cs
public class Document : BaseEntity
{
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
    
    // Workflow flags
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
    
    // 20 dynamic fields
    public string? Field01 { get; set; }
    public string? Field02 { get; set; }
    // ... Field03 to Field20
}

// Core.Domain/Enums/WorkflowStep.cs
public enum WorkflowStep
{
    Scan = 1,
    CheckScan1 = 2,
    CheckScan2 = 3,
    Zoning = 4,
    Ocr = 5,
    Extract = 6,
    Check1 = 7,
    Check2 = 8,
    CheckFinal = 9,
    CheckLogic = 10,
    Export = 11,
    Done = 99
}
```

---

## 4. SERVICE PATTERNS

### 4.1 Application Service Structure

```csharp
// Core.Application/Services/DocumentService.cs
public class DocumentService
{
    private readonly IRepository<Document> _documentRepo;
    private readonly IStorageService _storageService;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<DocumentService> _logger;
    
    public DocumentService(
        IRepository<Document> documentRepo,
        IStorageService storageService,
        ICurrentUser currentUser,
        ILogger<DocumentService> logger)
    {
        _documentRepo = documentRepo;
        _storageService = storageService;
        _currentUser = currentUser;
        _logger = logger;
    }
    
    public async Task<ServiceResult<DocumentDto>> CreateFromUploadAsync(
        UploadCallbackRequest request)
    {
        try
        {
            var document = new Document
            {
                ChannelId = request.ChannelId,
                FolderId = request.FolderId,
                DocTypeId = request.DocTypeId,
                StoredPath = request.StoredPath,
                OriginalFileName = request.OriginalFileName,
                FileSize = request.FileSize,
                Extension = request.Extension,
                PublicUrl = request.PublicUrl,
                CurrentStep = WorkflowStep.Scan,
                CreatedBy = request.CreatedBy ?? _currentUser.UserId
            };
            
            var id = await _documentRepo.InsertAsync(document);
            document.Id = id;
            
            return ServiceResult<DocumentDto>.Success(
                MapToDto(document));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create document from upload");
            return ServiceResult<DocumentDto>.Failure(
                "Tạo tài liệu thất bại");
        }
    }
}
```

### 4.2 ServiceResult Pattern

```csharp
// Shared.Contracts/ServiceResult.cs
public class ServiceResult<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? ErrorMessage { get; set; }
    public List<string> Errors { get; set; } = new();
    
    public static ServiceResult<T> Success(T data) => new()
    {
        Success = true,
        Data = data
    };
    
    public static ServiceResult<T> Failure(string error) => new()
    {
        Success = false,
        ErrorMessage = error
    };
}
```

---

## 5. AUTHENTICATION & AUTHORIZATION

### 5.1 Current User Pattern

```csharp
// Core.Domain/Contracts/ICurrentUser.cs
public interface ICurrentUser
{
    int UserId { get; }
    string Username { get; }
    string FullName { get; }
    int? ChannelId { get; }
    int? DeptId { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
    List<string> Roles { get; }
    List<string> Permissions { get; }
}

// Infrastructure.Identity/CurrentUser.cs
public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    
    public int UserId => int.Parse(
        _httpContextAccessor.HttpContext?.User
            .FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    
    public bool IsAdmin => _httpContextAccessor.HttpContext?.User
        .HasClaim("IsAdmin", "true") ?? false;
    
    // ... other properties from claims
}
```

### 5.2 Authorization Attributes

```csharp
// Web.Shared/Filters/AuthorizeModuleAttribute.cs
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AuthorizeModuleAttribute : Attribute, IAuthorizationFilter
{
    public string ModuleCode { get; set; }
    
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var currentUser = context.HttpContext.RequestServices
            .GetRequiredService<ICurrentUser>();
        
        if (!currentUser.IsAuthenticated)
        {
            context.Result = new RedirectToActionResult(
                "Login", "Account", null);
            return;
        }
        
        if (!currentUser.IsAdmin && 
            !currentUser.Permissions.Contains(ModuleCode))
        {
            context.Result = new ForbidResult();
        }
    }
}

// Usage in controller:
[AuthorizeModule(ModuleCode = "DOC_SCAN")]
public class ScanController : Controller
{
    // ...
}
```

### 5.3 Password Security (⚠️ CRITICAL ISSUE)

**Current implementation (INSECURE):**
```csharp
// Infrastructure.Identity/PlaintextPasswordHasher.cs
public class PlaintextPasswordHasher : IPasswordHasher
{
    public string HashPassword(string password) => password; // ❌ NO HASHING!
    public bool VerifyPassword(string hash, string password) => hash == password;
}
```

**⚠️ SECURITY CONCERN:** Passwords stored in plaintext in database.

**REQUIRED FIX:** Migrate to BCrypt:
```csharp
// Install: BCrypt.Net-Next
public class BCryptPasswordHasher : IPasswordHasher
{
    public string HashPassword(string password) 
        => BCrypt.Net.BCrypt.HashPassword(password);
    
    public bool VerifyPassword(string hash, string password) 
        => BCrypt.Net.BCrypt.Verify(password, hash);
}
```

---

## 6. FILE STORAGE PATTERN

### 6.1 Storage Service

```csharp
// Core.Domain/Contracts/IStorageService.cs
public interface IStorageService
{
    Task<StorageResult> SaveFileAsync(
        Stream fileStream, 
        string fileName, 
        string? subFolder = null);
    
    Task<bool> DeleteFileAsync(string storedPath);
    
    string GetPublicUrl(string storedPath);
}

// Infrastructure.Storage/LocalFileStorageService.cs
public class LocalFileStorageService : IStorageService
{
    private readonly string _rootPath;
    private readonly string _virtualPath;
    
    public async Task<StorageResult> SaveFileAsync(
        Stream fileStream, 
        string fileName, 
        string? subFolder = null)
    {
        var uniqueFileName = $"{Guid.NewGuid()}_{fileName}";
        var relativePath = Path.Combine(
            subFolder ?? "", uniqueFileName);
        var fullPath = Path.Combine(_rootPath, relativePath);
        
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        
        using var fileStreamOut = File.Create(fullPath);
        await fileStream.CopyToAsync(fileStreamOut);
        
        return new StorageResult
        {
            Success = true,
            StoredPath = relativePath.Replace("\\", "/"),
            PublicUrl = $"{_virtualPath}/{relativePath.Replace("\\", "/")}"
        };
    }
}
```

### 6.2 Upload Flow

```
Client → Web.Uploader (POST /api/upload/file)
   ↓
LocalFileStorageService.SaveFileAsync()
   ↓ returns StoredPath, PublicUrl
Client receives UploadFileResponse
   ↓
Client → Web.Uploader (POST /api/upload/callback)
   ↓
DocumentService.CreateFromUploadAsync()
   ↓ inserts into core_stg.documents
Success
```

---

## 7. FRONTEND PATTERNS

### 7.1 Technology Stack

- **Framework:** ASP.NET Core MVC (Razor Views)
- **CSS:** Bootstrap 5
- **JS:** jQuery 3.x
- **Theme:** Custom (based on AdminLTE structure)
- **PDF Viewer:** PDF.js
- **Icons:** Font Awesome 6

### 7.2 View Structure

```
Web.{Module}/Views/
├── Shared/
│   ├── _Layout.cshtml          # Main layout
│   ├── _ShtlSidebarBrand.cshtml # Sidebar brand
│   ├── _Sidebar.cshtml          # Navigation menu
│   └── _Header.cshtml           # Top header
├── {Controller}/
│   ├── Index.cshtml             # List view
│   ├── Form.cshtml              # Create/Edit form
│   └── Detail.cshtml            # Detail view
```

### 7.3 Common View Patterns

**List view with DataTables:**
```cshtml
@model PaginatedResult<DocumentDto>

<div class="card">
    <div class="card-header">
        <h3 class="card-title">Danh sách tài liệu</h3>
        <div class="card-tools">
            <a href="@Url.Action("Create")" class="btn btn-primary btn-sm">
                <i class="fas fa-plus"></i> Thêm mới
            </a>
        </div>
    </div>
    <div class="card-body">
        <table id="documentTable" class="table table-bordered table-hover">
            <thead>
                <tr>
                    <th>Mã tài liệu</th>
                    <th>Tên file</th>
                    <th>Bước hiện tại</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                @foreach (var doc in Model.Items)
                {
                    <tr>
                        <td>@doc.DocumentCode</td>
                        <td>@doc.OriginalFileName</td>
                        <td>@doc.CurrentStep</td>
                        <td>@doc.CreatedAt.ToString("dd/MM/yyyy")</td>
                        <td>
                            <a href="@Url.Action("Detail", new { id = doc.Id })" 
                               class="btn btn-sm btn-info">
                                <i class="fas fa-eye"></i>
                            </a>
                        </td>
                    </tr>
                }
            </tbody>
        </table>
    </div>
</div>

@section Scripts {
    <script>
        $(document).ready(function() {
            $('#documentTable').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
                }
            });
        });
    </script>
}
```

---

## 8. WORKFLOW SYSTEM

### 8.1 Workflow Steps

```
Scan → CheckScan1 → CheckScan2 → Zoning → OCR → Extract 
  → Check1 → Check2 → CheckFinal → CheckLogic → Export → Done
```

### 8.2 Workflow Service

```csharp
// Core.Application/Services/DocumentWorkflowService.cs
public class DocumentWorkflowService
{
    public async Task<ServiceResult> MoveToNextStepAsync(
        int documentId, 
        WorkflowStep currentStep)
    {
        var document = await _documentRepo.GetByIdAsync(documentId);
        if (document == null)
            return ServiceResult.Failure("Không tìm thấy tài liệu");
        
        if (document.CurrentStep != currentStep)
            return ServiceResult.Failure("Bước hiện tại không khớp");
        
        // Validate step completion flags
        if (!ValidateStepCompletion(document, currentStep))
            return ServiceResult.Failure("Chưa hoàn thành bước hiện tại");
        
        // Move to next step
        document.CurrentStep = GetNextStep(currentStep);
        document.UpdatedBy = _currentUser.UserId;
        document.UpdatedAt = DateTime.UtcNow;
        
        await _documentRepo.UpdateAsync(document);
        
        return ServiceResult.Success();
    }
    
    private WorkflowStep GetNextStep(WorkflowStep current)
    {
        return current switch
        {
            WorkflowStep.Scan => WorkflowStep.CheckScan1,
            WorkflowStep.CheckScan1 => WorkflowStep.CheckScan2,
            WorkflowStep.CheckScan2 => WorkflowStep.Zoning,
            WorkflowStep.Zoning => WorkflowStep.Ocr,
            WorkflowStep.Ocr => WorkflowStep.Extract,
            WorkflowStep.Extract => WorkflowStep.Check1,
            WorkflowStep.Check1 => WorkflowStep.Check2,
            WorkflowStep.Check2 => WorkflowStep.CheckFinal,
            WorkflowStep.CheckFinal => WorkflowStep.CheckLogic,
            WorkflowStep.CheckLogic => WorkflowStep.Export,
            WorkflowStep.Export => WorkflowStep.Done,
            _ => current
        };
    }
}
```

---

## 9. HARD CONSTRAINTS

### 9.1 Security

1. ⚠️ **CRITICAL:** Migrate from `PlaintextPasswordHasher` to BCrypt
2. All user input MUST be validated and sanitized
3. SQL injection prevention: Use parameterized queries (Dapper handles this)
4. XSS prevention: Use `@Html.DisplayFor()` / `@Html.Encode()` in views
5. CSRF protection: Use `@Html.AntiForgeryToken()` in forms

### 9.2 Performance

1. **N+1 Query Prevention:** Use `JOIN` in Dapper queries, not lazy loading
2. **Caching:** Implement Redis for frequently accessed config data
3. **File Upload:** Max 100MB per file (configurable in `appsettings.json`)
4. **Pagination:** Always paginate list views (use `PaginatedResult<T>`)

### 9.3 Database

1. **NO Foreign Keys:** Database scripts do NOT include FK constraints (by design)
2. **Multi-DB:** Each schema can be separate database
3. **Connection Pooling:** Enabled by default in SqlConnection
4. **Transaction Scope:** Use `TransactionScope` for cross-schema operations

### 9.4 Code Quality

1. **Async/Await:** All I/O operations MUST be async
2. **Dependency Injection:** Constructor injection only, no service locator
3. **Logging:** Use `ILogger<T>`, log all exceptions
4. **Error Handling:** Return `ServiceResult<T>`, never throw exceptions to controller

---

**END OF ARCHITECTURE REFERENCE**
