---
name: bugfix
description: "Bug Fixer: Fix bugs outside pipeline — trace, identify root cause, implement fix, verify"
argument-hint: "Bug description hoặc bug report file path"
agent: "Bug Fixer"
---
Fix bugs ngoài luồng pipeline.

## Input
- **Bug description** — Text mô tả bug
- **Bug report** — File path (if available)
- **Steps to reproduce** — Cách tái hiện bug

## Bắt buộc đọc
1. `.AIAgent/.github/context/agent-protocol.md` — protocol
2. `.AIAgent/.github/context/shtl-architecture.md` — SHTL patterns
3. `/memories/repo/common-build-errors.md` — known issues (if exists)

## Bug Fix Workflow

### Step 1: Understand Bug
1. Đọc bug description
2. Identify:
   - What is expected?
   - What is actual behavior?
   - Which module/feature affected?
   - Severity: CRITICAL / HIGH / MEDIUM / LOW

### Step 2: Trace Code
1. **Identify entry point:**
   - Controller action (if web bug)
   - Service method (if business logic bug)
   - Repository query (if data bug)

2. **Trace execution flow:**
   ```
   Controller → Service → Repository → Database
   ```

3. **Use GitNexus (if available):**
   ```
   user-gitnexus-query: "How does {feature} work?"
   user-gitnexus-context: {symbol: "{MethodName}"}
   ```

### Step 3: Identify Root Cause
Common bug patterns:

| Pattern | Root Cause | Fix |
|---------|------------|-----|
| **Data not displayed** | Missing WHERE filter | Add `WHERE ChannelId = @ChannelId AND IsDeleted = 0` |
| **Null reference** | Missing null check | Add `if (entity == null) return NotFound();` |
| **Wrong data shown** | Missing authorization check | Add ChannelId filter + IsAdmin check |
| **SQL error** | SQL injection or syntax | Use parameterized query |
| **Build error** | Missing DI registration | Add to AppServiceExtensions or DataServiceExtensions |
| **500 error** | Unhandled exception | Add try-catch + logging |

### Step 4: Implement Fix
1. **Locate file** to fix
2. **Read current code**
3. **Apply fix** using pattern from Step 3
4. **Verify fix** doesn't break other code

### Step 5: Verify
1. **Build verify:**
   ```powershell
   cd E:\DATN\SHTLSource\src
   dotnet build
   ```

2. **Manual test:**
   - Reproduce original bug → Should be fixed
   - Test related features → Should still work
   - Test edge cases

3. **Check logs** for errors

### Step 6: Document
Tạo `.docs/bugfix/BUG_FIX_LOG_{NNN}.md`:
```markdown
# BUG FIX LOG #{NNN}

**Date:** 2026-04-12  
**Severity:** CRITICAL / HIGH / MEDIUM / LOW  
**Reporter:** {User/System}  
**Fixer:** Bug Fixer

## Bug Description
{Mô tả bug}

## Steps to Reproduce
1. {Step 1}
2. {Step 2}
3. {Expected vs Actual}

## Root Cause
{Nguyên nhân gốc rễ}

## Files Changed
- `{path/to/file.cs}` — {what changed}

## Fix Details
```csharp
// Before
{old code}

// After
{new code}
```

## Verification
- [x] Build passes
- [x] Bug fixed (manual test)
- [x] Related features still work
- [x] No new errors in logs

## Prevention
{Làm sao tránh bug này trong tương lai}
```

## Memory Protocol
Ghi `/memories/repo/common-build-errors.md` nếu bug liên quan build:
```markdown
### [BUG-{NNN}] {Short Description}
- **Pattern:** {Error pattern}
- **Root Cause:** {Why it happened}
- **Fix:** {Code snippet}
- **Prevention:** {How to avoid}
```

## Handoff
Không cần handoff — Bug Fixer hoạt động độc lập ngoài pipeline.

Thông báo user:
```
✅ Bug fixed!

Issue: {bug description}
Root cause: {root cause}
Files changed: {N} files
Verification: Build passes + manual test OK

Details: .docs/bugfix/BUG_FIX_LOG_{NNN}.md
```
