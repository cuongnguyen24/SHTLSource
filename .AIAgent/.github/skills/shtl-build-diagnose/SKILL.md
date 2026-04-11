---
name: shtl-build-diagnose
version: "1.0"
last_updated: "12/04/2026"
status: active
description: "**DOMAIN SKILL** — Diagnose and fix SHTL solution build errors. USE FOR: interpreting dotnet build output, identifying common SHTL-specific build errors (missing DI registration, Dapper issues, connection string problems, Clean Architecture violations), and applying targeted fixes. USED BY: Backend Developer, Frontend Developer, Bug Fixer."
---

# SHTL Build Diagnosis & Fix — Error Resolution Workflow

## PURPOSE
Step-by-step workflow to diagnose `dotnet build` errors in SHTL project, map them to common SHTL-specific root causes, and apply targeted fixes. Prevents trial-and-error debugging by leveraging known error patterns.

## WHEN TO USE
- After `dotnet build` returns errors
- When troubleshooting compilation failures in any layer
- Before committing code (pre-flight build check)
- During fix-loop after code review

## WORKFLOW

### Step 1: Run Build

```powershell
cd E:\DATN\SHTLSource\src
dotnet build
```

If too many errors, focus on **first error** — later errors are often cascading.

### Step 2: Classify Error

Read the error code and message, then match to the categories below.

### Step 3: Apply Fix

Follow the specific resolution for the matched category.

### Step 4: Re-build & Verify

```powershell
dotnet build
```

Repeat until 0 errors. If stuck after 3 attempts on same error → check `/memories/repo/common-build-errors.md` or escalate.

---

## ERROR CATEGORIES

### Category 1: Missing Type / Namespace (CS0246, CS0234)

**Symptom:** `error CS0246: The type or namespace name '{Name}' could not be found`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Missing `using` statement | Add `using Core.Domain.Entities.{Schema};` or appropriate namespace |
| Entity class not created yet | Create entity in `Core.Domain/Entities/{Schema}/` |
| DTO not created | Create DTO in `Shared.Contracts/` |
| Repository interface not created | Create in `Core.Domain/Contracts/` |
| Wrong project reference | Check `.csproj` has `<ProjectReference>` to dependency project |
| Typo in class name | Verify spelling matches file name exactly (PascalCase) |

**Diagnosis command:**
```powershell
# Find where the type IS defined
Get-ChildItem -Recurse -Filter "*.cs" | Select-String -Pattern "class {TypeName}" | Select-Object Path
```

### Category 2: Missing Member (CS1061, CS0117)

**Symptom:** `error CS1061: '{Type}' does not contain a definition for '{Member}'`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Property not added to entity | Add property to entity class (inherit BaseEntity) |
| Method not in service | Add method to service class |
| Repository method missing | Implement method in repository class |
| DTO property missing | Add property to DTO class |
| Wrong DTO used | Check if using Request vs Response DTO |

### Category 3: Interface Not Implemented (CS0535)

**Symptom:** `error CS0535: '{Class}' does not implement interface member '{Method}'`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| New method added to `IRepository<T>` but not implemented | Implement method in repository class |
| Method signature mismatch | Ensure return type + parameters match exactly |
| Missing async/await | Interface has `Task<T>`, implementation must be `async Task<T>` |

**Fix pattern:**
```csharp
// Interface
Task<Document?> GetByIdAsync(int id);

// Implementation
public async Task<Document?> GetByIdAsync(int id)
{
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    return await conn.QuerySingleOrDefaultAsync<Document>(
        "SELECT * FROM core_stg.documents WHERE Id = @Id AND IsDeleted = 0",
        new { Id = id });
}
```

### Category 4: Dependency Injection (CS1729, CS7036)

**Symptom:** `error CS1729: '{Type}' does not contain a constructor that takes {N} arguments`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Service not registered in DI | Add to `AppServiceExtensions.cs`: `services.AddScoped<DocumentService>();` |
| Repository not registered | Add to `DataServiceExtensions.cs`: `services.AddScoped<IRepository<Document>, StgRepository>();` |
| Missing constructor parameter | Add parameter to constructor |
| Wrong service lifetime | Change `AddScoped` to `AddSingleton` or `AddTransient` if needed |

**Fix pattern:**
```csharp
// Core.Application/AppServiceExtensions.cs
public static IServiceCollection AddApplicationServices(this IServiceCollection services)
{
    services.AddScoped<DocumentService>();
    services.AddScoped<UserManagementService>();
    // ... other services
    return services;
}

// Infrastructure.Data/DataServiceExtensions.cs
public static IServiceCollection AddDataServices(
    this IServiceCollection services,
    IConfiguration configuration)
{
    services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
    services.AddScoped<IRepository<Document>, StgRepository>();
    // ... other repositories
    return services;
}
```

### Category 5: Nullable Reference Types (CS8600, CS8602, CS8604)

**Symptom:** `warning CS8602: Dereference of a possibly null reference`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Property not marked nullable | Add `?` to type: `public string? OptionalField { get; set; }` |
| Missing null check | Add null check before dereferencing |
| Non-nullable property without default | Add `= string.Empty;` or `= default!;` |

**Fix pattern:**
```csharp
// ❌ BAD
public string Name { get; set; }  // CS8618: Non-nullable property must contain a non-null value

// ✅ GOOD
public string Name { get; set; } = string.Empty;

// ❌ BAD
var user = await _userRepo.GetByIdAsync(id);
var name = user.FullName;  // CS8602: Possible null reference

// ✅ GOOD
var user = await _userRepo.GetByIdAsync(id);
if (user == null) return NotFound();
var name = user.FullName;
```

### Category 6: Connection String / Database (Runtime)

**Symptom:** `InvalidOperationException: Connection string not found`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| `connectionstrings.json` missing | Verify file exists in `config/` folder next to `.dll` |
| Wrong connection key | Check key matches: `CoreAcc`, `CoreCnf`, `CoreStg`, `CoreLog`, `CoreMsg`, `CoreCatalog` |
| File not copied during build | Check `Directory.Build.props` has copy task |
| Wrong path in `Program.cs` | Verify: `Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json")` |

**Fix pattern:**
```csharp
// Program.cs
builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"),
                 optional: false, reloadOnChange: true);

// Repository
using var conn = _connectionFactory.CreateConnection("CoreStg");  // Must match key in connectionstrings.json
```

### Category 7: Dapper Query Issues (Runtime)

**Symptom:** `SqlException: Invalid column name` or `ArgumentException: When using the multi-mapping APIs`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Column name mismatch | Verify SQL column names match C# property names |
| Missing `IsDeleted` filter | Add `AND IsDeleted = 0` to WHERE clause |
| Wrong schema prefix | Use `core_stg.documents` not just `documents` |
| Multi-mapping without splitOn | Add `splitOn` parameter to `QueryAsync` |

**Fix pattern:**
```csharp
// ❌ BAD: Missing schema prefix, missing IsDeleted filter
var sql = "SELECT * FROM documents WHERE Id = @Id";

// ✅ GOOD
var sql = "SELECT * FROM core_stg.documents WHERE Id = @Id AND IsDeleted = 0";

// ❌ BAD: Column name mismatch
public class Document { public string DocCode { get; set; } }  // Property: DocCode
var sql = "SELECT DocumentCode FROM ...";  // Column: DocumentCode

// ✅ GOOD: Match names or use alias
var sql = "SELECT DocumentCode AS DocCode FROM ...";
```

### Category 8: Clean Architecture Violations (CS0234)

**Symptom:** `error CS0234: The type or namespace name 'Infrastructure' does not exist in the namespace 'Core.Domain'`

**Common SHTL Causes:**

| Cause | Fix |
|-------|-----|
| Domain depends on Infrastructure | Remove reference, use contracts instead |
| Application depends on Web | Remove reference, Web depends on Application |
| Circular dependency | Refactor to use interfaces in Domain |

**Fix pattern:**
```csharp
// ❌ BAD: Domain depends on Infrastructure
namespace Core.Domain.Entities;
using Infrastructure.Data;  // VIOLATION!

// ✅ GOOD: Domain is pure
namespace Core.Domain.Entities;
public class Document : BaseEntity { }

// ❌ BAD: Application depends on Web
namespace Core.Application.Services;
using Web.SoHoa.Controllers;  // VIOLATION!

// ✅ GOOD: Application only depends on Domain
namespace Core.Application.Services;
using Core.Domain.Entities.Stg;
```

---

## COMMON BUILD ERROR PATTERNS

### Pattern 1: "Cannot resolve service for type 'IRepository<T>'"

**Root Cause:** Repository not registered in DI container.

**Fix:**
```csharp
// Infrastructure.Data/DataServiceExtensions.cs
services.AddScoped<IRepository<Document>, StgRepository>();
```

### Pattern 2: "The name 'ServiceResult' does not exist"

**Root Cause:** Missing using statement or wrong namespace.

**Fix:**
```csharp
using Shared.Contracts;  // ServiceResult is here
```

### Pattern 3: "BaseEntity does not contain a definition for 'Id'"

**Root Cause:** Entity not inheriting from BaseEntity.

**Fix:**
```csharp
// ❌ BAD
public class Document { }

// ✅ GOOD
public class Document : BaseEntity { }
```

### Pattern 4: "Cannot convert from 'Task<ServiceResult>' to 'ServiceResult'"

**Root Cause:** Missing `await` keyword.

**Fix:**
```csharp
// ❌ BAD
var result = _service.CreateAsync(request);  // Missing await

// ✅ GOOD
var result = await _service.CreateAsync(request);
```

---

## MEMORY PROTOCOL

### When encountering NEW build error:

1. **Diagnose** using this skill
2. **Fix** using pattern above
3. **Verify** build passes
4. **Document** in `/memories/repo/common-build-errors.md`:

```markdown
### [{ErrorCode}] {Short Description}
- **Version:** 1 | **Status:** active
- **Created:** 2026-04-12
- **Source:** {Module/file where encountered}
- **Pattern:** {Error message pattern}
- **Root Cause:** {Why it happened}
- **Fix:** {Code snippet or instruction}
```

---

## ESCALATION

If stuck after 3 fix attempts:
1. Check `/memories/repo/common-build-errors.md` for similar errors
2. Search codebase for similar working code
3. Escalate to Tech Lead with:
   - Full error message
   - File/line number
   - What you tried
   - Build output

---

**END OF SKILL**
