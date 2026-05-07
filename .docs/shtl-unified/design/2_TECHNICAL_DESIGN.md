# TECHNICAL DESIGN: SHTL Admin + SoHoa Unified System

**Version:** 1.0  
**Date:** 2026-04-12  
**Author:** Solution Architect (via AI Agent System)  
**Based on:** `1_PRD.md` v1.0

---

## 1. ARCHITECTURE DECISIONS

### ADR-001: Password Security - Migrate to BCrypt

**Status:** ✅ ACCEPTED  
**Date:** 2026-04-12

**Context:**
Hệ thống hiện tại sử dụng `PlaintextPasswordHasher` — lưu password dạng plain text trong database. Đây là CRITICAL security vulnerability.

**Decision:**
Migrate sang BCrypt:
- Thư viện: `BCrypt.Net-Next` (workFactor: 12)
- Cập nhật `Infrastructure.Identity/PasswordHasher.cs`
- Tạo migration script cho existing passwords

**Alternatives Considered:**
| Option | Mô tả | Reason not chosen |
|--------|--------|-------------------|
| PBKDF2 | Microsoft built-in | BCrypt widely used, simpler |
| Argon2 | Winner 2015 | BCrypt sufficient for this use case |

---

### ADR-002: Multi-Database Schema

**Status:** ✅ ACCEPTED  
**Date:** 2026-04-12

**Context:**
SHTL sử dụng 6 schemas: core_acc, core_cnf, core_stg, core_log, core_msg, core_catalog

**Decision:**
Giữ nguyên multi-DB architecture:
- Mỗi bounded context có database riêng
- Connection factory quản lý connection strings
- Repository pattern với Dapper

---

### ADR-003: Service Pattern

**Status:** ✅ ACCEPTED  
**Date:** 2026-04-12

**Context:**
Cần chuẩn hóa service return types

**Decision:**
Sử dụng `ApiResult<T>` pattern (đã có sẵn):
- Commands return `ApiResult<T>`
- Queries return `PaginatedResult<T>` hoặc data directly

---

## 2. DATABASE DESIGN

### 2.1 Existing Entities (No Changes Needed)

**core_acc:**
- User, Role, Dept, Position, Team
- UserRole, UserDept, UserTeam
- ModulePermission

**core_cnf:**
- Channel, ContentType, RecordType, SyncType, ExportType, Config

**core_stg:**
- Document, DocumentFolder, FormCell, ExportJob

**core_log:**
- AccessLog, ActionLog, ErrorLog

**core_msg:**
- Notification (cần tạo service)

---

## 3. APPLICATION LAYER

### 3.1 Services (Existing)

| Service | Interface | Implementation | Status |
|---------|-----------|----------------|--------|
| UserManagementService | IUserManagementService | Implemented | ✅ |
| RoleService | IRoleService | Implemented | ✅ |
| DeptService | IDeptService | Implemented | ✅ |
| AuthAppService | IAuthAppService | Implemented | ✅ |
| ConfigService | IConfigService | Implemented | ✅ |
| LogService | ILogService | Implemented | ✅ |
| DocumentService | IDocumentService | Implemented | ✅ |
| DocumentWorkflowService | IDocumentWorkflowService | Implemented | ✅ |
| ReportService | IReportService | Implemented | ✅ |

### 3.2 Services (Missing - TODO)

| Service | Interface | Implementation | Status |
|---------|-----------|----------------|--------|
| NotificationService | INotificationService | Missing | ❌ TODO |
| PositionService | IPositionService | Missing | ❌ TODO |
| TeamService | ITeamService | Missing | ❌ TODO |
| PermissionService | IPermissionService | Missing | ❌ TODO |

---

## 4. SECURITY FIXES

### 4.1 BCrypt Migration (CRITICAL)

**File:** `Infrastructure.Identity/PasswordHasher.cs`

```csharp
// Install: dotnet add package BCrypt.Net-Next

namespace Infrastructure.Identity;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public sealed class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;
    
    public string Hash(string password)
    {
        if (string.IsNullOrEmpty(password))
            return string.Empty;
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }
    
    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash))
            return false;
        
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }
}
```

**DI Registration:**
```csharp
// Infrastructure.Identity/IdentityServiceExtensions.cs
public static IServiceCollection AddIdentityServices(this IServiceCollection services)
{
    services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
    // ... other services
}
```

**Migration Script:**
```csharp
// Migration: Hash existing plaintext passwords
var users = await _userRepo.GetAllAsync();
foreach (var user in users)
{
    if (!string.IsNullOrEmpty(user.PasswordHash) && !user.PasswordHash.StartsWith("$2"))
    {
        user.PasswordHash = _hasher.Hash(user.PasswordHash);
        await _userRepo.UpdateAsync(user);
    }
}
```

---

## 5. IMPLEMENTATION TASKS

### Task List

#### Critical (Must Fix)

| Task ID | Description | File | Priority |
|---------|-------------|------|----------|
| T-001 | Migrate PlaintextPasswordHasher → BCryptPasswordHasher | Infrastructure.Identity/PasswordHasher.cs | 🔴 CRITICAL |
| T-002 | Register BCryptPasswordHasher in DI | Infrastructure.Identity/IdentityServiceExtensions.cs | 🔴 CRITICAL |
| T-003 | Run password migration for existing users | Migration script | 🔴 CRITICAL |

#### High Priority

| Task ID | Description | File | Priority |
|---------|-------------|------|----------|
| T-004 | Create NotificationService | Core.Application/Services/NotificationService.cs | 🟡 HIGH |
| T-005 | Create PositionService | Core.Application/Services/PositionService.cs | 🟡 HIGH |
| T-006 | Create TeamService | Core.Application/Services/TeamService.cs | 🟡 HIGH |
| T-007 | Complete PermissionService | Core.Application/Services/PermissionService.cs | 🟡 HIGH |

#### Medium Priority

| Task ID | Description | File | Priority |
|---------|-------------|------|----------|
| T-008 | Complete ConfigVersionController | Web.Admin/Controllers/ConfigVersionController.cs | 🟡 MEDIUM |
| T-009 | Add PositionController | Web.Admin/Controllers/PositionController.cs | 🟡 MEDIUM |
| T-010 | Add TeamController | Web.Admin/Controllers/TeamController.cs | 🟡 MEDIUM |
| T-011 | Add NotificationController | Web.Admin/Controllers/NotificationController.cs | 🟡 MEDIUM |

---

## 6. CONTROLLERS

### 6.1 Admin Controllers (Existing)

| Controller | Status | Notes |
|------------|--------|-------|
| AccountController | ✅ | Login/Logout |
| UserController | ✅ | CRUD |
| RoleController | ✅ | CRUD + Permissions |
| DeptController | ✅ | CRUD |
| ConfigController | ✅ | Full CRUD |
| LogController | ✅ | Access + Action logs |
| ExportTypeController | ✅ | CRUD |
| HomeController | ✅ | Dashboard |

### 6.2 Admin Controllers (Missing)

| Controller | Status | Notes |
|------------|--------|-------|
| PositionController | ❌ TODO | Need to create |
| TeamController | ❌ TODO | Need to create |
| NotificationController | ❌ TODO | Need to create |
| ConfigVersionController | ⚠️ STUB | Need to implement or remove |

### 6.3 SoHoa Controllers (Existing)

| Controller | Status | Notes |
|------------|--------|-------|
| AccountController | ✅ | Login/Logout |
| ScanController | ✅ | Scan + CheckScan1/2 |
| CheckController | ✅ | Check1/2/Final/Logic |
| ExtractController | ✅ | Extract form |
| ExportController | ✅ | Export request |
| SyncUploadController | ✅ | Sync upload |
| LoaiTaiLieuController | ✅ | Document types |
| LoaiDongBoController | ✅ | Sync types |

---

## 7. AUTHORIZATION

### 7.1 Module Codes

**Admin Modules (100-111):**
| Code | Module | Controller |
|------|--------|-------------|
| ADM_USER | User Management | UserController |
| ADM_ROLE | Role Management | RoleController |
| ADM_DEPT | Department | DeptController |
| ADM_CONFIG | System Config | ConfigController |
| ADM_LOG | System Logs | LogController |

**SoHoa Modules (200-262):**
| Code | Module | Controller |
|------|--------|-------------|
| SH_SCAN | Scan/Upload | ScanController |
| SH_CHECK | Quality Check | CheckController |
| SH_EXTRACT | Data Entry | ExtractController |
| SH_EXPORT | Export | ExportController |
| SH_SYNC | Sync Upload | SyncUploadController |
| SH_LOAI_TL | Doc Types | LoaiTaiLieuController |
| SH_LOAI_DB | Sync Types | LoaiDongBoController |

### 7.2 Permission Model

```csharp
public class ModulePermission
{
    public int RoleId { get; set; }
    public int ModuleId { get; set; }
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
    public bool CanApprove { get; set; }
    public bool CanExport { get; set; }
}
```

---

## 8. CROSS-CUTTING CONCERNS

### 8.1 Authentication
- Cookie-based authentication (đã có)
- Session timeout: 8 hours
- Login/Logout tracking

### 8.2 Authorization
- `[Authorize]` + custom attribute
- Module-based permission check
- ChannelId filtering (multi-tenant)

### 8.3 Logging
- Access logs: Login/Logout
- Action logs: All CUD operations
- Error logs: Exceptions

### 8.4 Error Handling
- Services return `ApiResult<T>`
- Controllers catch exceptions
- User-friendly error messages

---

## 9. VERIFICATION CHECKLIST

### Before Deploy

- [ ] BCrypt migration complete
- [ ] All controllers have [Authorize]
- [ ] All POST actions have [ValidateAntiForgeryToken]
- [ ] All services use ApiResult<T>
- [ ] All repositories filter by ChannelId
- [ ] All list queries use pagination
- [ ] Build passes with 0 errors
- [ ] Manual test all CRUD operations

### Security Checklist

- [ ] Passwords hashed with BCrypt
- [ ] SQL injection impossible (parameterized queries)
- [ ] XSS prevention (HTML encoding)
- [ ] Authorization on all actions
- [ ] No sensitive data in logs

---

**APPROVAL:**
- Solution Architect: ✅ 2026-04-12
- Tech Lead: ⏳ Pending review
- Security Review: ⏳ Pending