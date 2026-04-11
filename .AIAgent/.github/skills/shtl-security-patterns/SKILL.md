---
name: shtl-security-patterns
version: "1.0"
last_updated: "12/04/2026"
status: active
description: "**DOMAIN SKILL** — Security fix patterns for SHTL project. USE FOR: fixing common security vulnerabilities (SQL injection, XSS, authorization bypass, password security), applying OWASP best practices. USED BY: Security Fixer, Backend Developer, Security Reviewer."
---

# SHTL Security Fix Patterns

## PURPOSE
Catalog of security vulnerability patterns in SHTL codebase and their fixes. Organized by CWE (Common Weakness Enumeration) categories.

## WHEN TO USE
- After security scan (Checkmarx, SonarQube, etc.)
- During security review
- When implementing authentication/authorization
- Before production deployment

---

## CRITICAL SECURITY ISSUES

### 🔴 CRITICAL-001: Plaintext Password Storage

**CWE:** CWE-256 (Plaintext Storage of a Password)

**Current Code (INSECURE):**
```csharp
// Infrastructure.Identity/PlaintextPasswordHasher.cs
public class PlaintextPasswordHasher : IPasswordHasher
{
    public string HashPassword(string password) => password;  // ❌ NO HASHING!
    public bool VerifyPassword(string hash, string password) => hash == password;
}
```

**Impact:** CRITICAL — All user passwords stored in plaintext in database. Complete compromise if database leaked.

**Fix:**
```csharp
// 1. Install BCrypt.Net-Next
// dotnet add package BCrypt.Net-Next

// 2. Create new hasher
// Infrastructure.Identity/BCryptPasswordHasher.cs
using BCrypt.Net;

public class BCryptPasswordHasher : IPasswordHasher
{
    public string HashPassword(string password)
    {
        return BCrypt.HashPassword(password, workFactor: 12);
    }
    
    public bool VerifyPassword(string hash, string password)
    {
        try
        {
            return BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }
}

// 3. Register in DI
// Infrastructure.Identity/IdentityServiceExtensions.cs
services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();

// 4. Migration script for existing passwords
// db/migrate_passwords.sql
-- WARNING: This requires users to reset passwords
-- Option 1: Force password reset
UPDATE core_acc.users SET PasswordHash = NULL, RequirePasswordReset = 1;

-- Option 2: Migrate if you have plaintext (NOT RECOMMENDED in production)
-- Run C# migration script to hash existing passwords
```

**Verification:**
```csharp
// Test
var hasher = new BCryptPasswordHasher();
var hash = hasher.HashPassword("test123");
Console.WriteLine(hash);  // Should be: $2a$12$...
Console.WriteLine(hasher.VerifyPassword(hash, "test123"));  // True
Console.WriteLine(hasher.VerifyPassword(hash, "wrong"));    // False
```

---

## SQL INJECTION PATTERNS

### 🔴 HIGH-001: SQL Injection via String Concatenation

**CWE:** CWE-89 (SQL Injection)

**Vulnerable Code:**
```csharp
// ❌ BAD: String concatenation
public async Task<Document?> GetByCodeAsync(string code)
{
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    var sql = $"SELECT * FROM core_stg.documents WHERE DocumentCode = '{code}'";
    return await conn.QuerySingleOrDefaultAsync<Document>(sql);
}
```

**Attack Vector:**
```csharp
var code = "'; DROP TABLE documents; --";
// Executes: SELECT * FROM documents WHERE DocumentCode = ''; DROP TABLE documents; --'
```

**Fix:**
```csharp
// ✅ GOOD: Parameterized query
public async Task<Document?> GetByCodeAsync(string code)
{
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    var sql = "SELECT * FROM core_stg.documents WHERE DocumentCode = @Code AND IsDeleted = 0";
    return await conn.QuerySingleOrDefaultAsync<Document>(sql, new { Code = code });
}
```

**Pattern:** ALWAYS use Dapper parameters (`@ParamName` + anonymous object)

### 🔴 HIGH-002: SQL Injection via Dynamic WHERE Clause

**Vulnerable Code:**
```csharp
// ❌ BAD: Building WHERE clause from user input
public async Task<IEnumerable<Document>> SearchAsync(string field, string value)
{
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    var sql = $"SELECT * FROM core_stg.documents WHERE {field} = '{value}'";
    return await conn.QueryAsync<Document>(sql);
}
```

**Fix:**
```csharp
// ✅ GOOD: Whitelist allowed fields
public async Task<IEnumerable<Document>> SearchAsync(string field, string value)
{
    var allowedFields = new[] { "DocumentCode", "OriginalFileName", "Extension" };
    if (!allowedFields.Contains(field))
        throw new ArgumentException("Invalid field name");
    
    using var conn = _connectionFactory.CreateConnection("CoreStg");
    var sql = $"SELECT * FROM core_stg.documents WHERE {field} = @Value AND IsDeleted = 0";
    return await conn.QueryAsync<Document>(sql, new { Value = value });
}
```

---

## XSS (CROSS-SITE SCRIPTING) PATTERNS

### 🟡 MEDIUM-001: XSS via Unencoded User Input

**CWE:** CWE-79 (Cross-site Scripting)

**Vulnerable Code:**
```cshtml
<!-- ❌ BAD: Raw HTML output -->
<div>@Model.UserComment</div>
```

**Attack Vector:**
```
UserComment = "<script>alert('XSS')</script>"
```

**Fix:**
```cshtml
<!-- ✅ GOOD: Automatic HTML encoding -->
<div>@Model.UserComment</div>  <!-- Razor auto-encodes by default -->

<!-- ✅ GOOD: Explicit encoding -->
<div>@Html.Encode(Model.UserComment)</div>

<!-- ⚠️ ONLY use @Html.Raw() for trusted content -->
<div>@Html.Raw(Model.TrustedHtmlContent)</div>
```

**Pattern:** Razor Views auto-encode `@` expressions. NEVER use `@Html.Raw()` with user input.

### 🟡 MEDIUM-002: XSS via JavaScript String

**Vulnerable Code:**
```cshtml
<script>
    var userName = '@Model.UserName';  // ❌ BAD: Not JavaScript-safe
</script>
```

**Attack Vector:**
```
UserName = "'; alert('XSS'); //"
```

**Fix:**
```cshtml
<script>
    var userName = @Json.Serialize(Model.UserName);  // ✅ GOOD: JSON-encoded
</script>
```

---

## AUTHORIZATION PATTERNS

### 🔴 HIGH-003: Missing Authorization Check

**Vulnerable Code:**
```csharp
// ❌ BAD: No authorization
[HttpPost]
public async Task<IActionResult> Delete(int id)
{
    await _documentService.DeleteAsync(id);
    return Json(new { success = true });
}
```

**Attack Vector:** Any authenticated user can delete any document.

**Fix:**
```csharp
// ✅ GOOD: Authorization attribute + permission check
[Authorize]
[AuthorizeModule(ModuleCode = "DOC_MANAGE")]
[HttpPost]
public async Task<IActionResult> Delete(int id)
{
    // Additional check: User can only delete own channel's documents
    var document = await _documentService.GetByIdAsync(id);
    if (document == null)
        return NotFound();
    
    if (document.ChannelId != _currentUser.ChannelId && !_currentUser.IsAdmin)
        return Forbid();
    
    await _documentService.DeleteAsync(id);
    return Json(new { success = true });
}
```

**Pattern:** ALWAYS use `[Authorize]` + `[AuthorizeModule]` + data-level permission check.

### 🔴 HIGH-004: Insecure Direct Object Reference (IDOR)

**Vulnerable Code:**
```csharp
// ❌ BAD: No ownership check
[HttpGet]
public async Task<IActionResult> Detail(int id)
{
    var document = await _documentService.GetByIdAsync(id);
    return View(document);
}
```

**Attack Vector:** User can view documents from other channels by guessing IDs.

**Fix:**
```csharp
// ✅ GOOD: Filter by user's channel
[HttpGet]
public async Task<IActionResult> Detail(int id)
{
    var document = await _documentService.GetByIdAsync(id);
    if (document == null)
        return NotFound();
    
    // Check ownership
    if (document.ChannelId != _currentUser.ChannelId && !_currentUser.IsAdmin)
        return Forbid();
    
    return View(document);
}
```

**Pattern:** ALWAYS verify user has permission to access the resource.

---

## AUTHENTICATION PATTERNS

### 🟡 MEDIUM-003: Missing CSRF Protection

**Vulnerable Code:**
```csharp
// ❌ BAD: No CSRF token
[HttpPost]
public async Task<IActionResult> Create(CreateDocumentRequest request)
{
    await _documentService.CreateAsync(request);
    return RedirectToAction("Index");
}
```

**Fix:**
```csharp
// ✅ GOOD: CSRF token validation
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create(CreateDocumentRequest request)
{
    if (!ModelState.IsValid)
        return View(request);
    
    await _documentService.CreateAsync(request);
    return RedirectToAction("Index");
}
```

**View:**
```cshtml
<form method="post">
    @Html.AntiForgeryToken()
    <!-- form fields -->
</form>
```

**Pattern:** ALWAYS use `[ValidateAntiForgeryToken]` on POST actions + `@Html.AntiForgeryToken()` in forms.

### 🟡 MEDIUM-004: Session Fixation

**Vulnerable Code:**
```csharp
// ❌ BAD: Reuse existing session after login
public async Task<IActionResult> Login(LoginRequest request)
{
    var user = await _authService.ValidateAsync(request.Username, request.Password);
    if (user == null)
        return View();
    
    // Set claims without regenerating session
    var claims = new List<Claim> { /* ... */ };
    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    await HttpContext.SignInAsync(new ClaimsPrincipal(identity));
    
    return RedirectToAction("Index", "Home");
}
```

**Fix:**
```csharp
// ✅ GOOD: Regenerate session after login
public async Task<IActionResult> Login(LoginRequest request)
{
    var user = await _authService.ValidateAsync(request.Username, request.Password);
    if (user == null)
        return View();
    
    // Sign out first to clear old session
    await HttpContext.SignOutAsync();
    
    // Create new session with claims
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim("ChannelId", user.ChannelId?.ToString() ?? ""),
        new Claim("IsAdmin", user.IsAdmin.ToString())
    };
    
    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);
    
    await HttpContext.SignInAsync(principal, new AuthenticationProperties
    {
        IsPersistent = request.RememberMe,
        ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
    });
    
    return RedirectToAction("Index", "Home");
}
```

---

## DATA PROTECTION PATTERNS

### 🟡 MEDIUM-005: Sensitive Data in Logs

**Vulnerable Code:**
```csharp
// ❌ BAD: Logging sensitive data
_logger.LogInformation("User login: {Username}, Password: {Password}", 
    request.Username, request.Password);
```

**Fix:**
```csharp
// ✅ GOOD: Never log passwords
_logger.LogInformation("User login attempt: {Username}", request.Username);

// ✅ GOOD: Mask sensitive data if needed
_logger.LogInformation("User login: {Username}, PasswordHash: {Hash}", 
    request.Username, "***");
```

**Pattern:** NEVER log passwords, tokens, or PII. Use structured logging with sanitization.

### 🟡 MEDIUM-006: Sensitive Data in Error Messages

**Vulnerable Code:**
```csharp
// ❌ BAD: Exposing internal details
catch (SqlException ex)
{
    return BadRequest($"Database error: {ex.Message}");
}
```

**Fix:**
```csharp
// ✅ GOOD: Generic error message to user, detailed log
catch (SqlException ex)
{
    _logger.LogError(ex, "Database error while creating document");
    return BadRequest("Đã xảy ra lỗi. Vui lòng thử lại sau.");
}
```

---

## SECURITY CHECKLIST

### Before Deployment

- [ ] All passwords hashed with BCrypt (workFactor ≥ 12)
- [ ] All SQL queries parameterized (no string concatenation)
- [ ] All POST actions have `[ValidateAntiForgeryToken]`
- [ ] All controllers have `[Authorize]` + `[AuthorizeModule]`
- [ ] All data access checks user's ChannelId
- [ ] No sensitive data in logs or error messages
- [ ] Connection strings in secure config (not in code)
- [ ] HTTPS enforced in production
- [ ] Session timeout configured (≤ 8 hours)
- [ ] Input validation on all user input

---

**END OF SKILL**
