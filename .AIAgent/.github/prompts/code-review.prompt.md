---
name: code-review
description: "Code Reviewer: Review code correctness, SRS compliance, SHTL patterns, security basics"
argument-hint: "Tên module (phải có sẵn .docs/{module}/design/2_TECHNICAL_DESIGN.md và code đã implement)"
agent: "Code Reviewer"
---
Review code quality và compliance với specs.

## Input
- **Tên module** — tìm `.docs/{module}/design/` và code files

Nếu code chưa implement → DỪNG, yêu cầu Backend Developer implement trước.

## Bắt buộc đọc
1. `.AIAgent/.github/context/agent-protocol.md` — protocol
2. `.docs/{module}/state/MODULE_STATE.md` — verify QUALITY phase
3. `.docs/{module}/design/1_PRD.md` — acceptance criteria
4. `.docs/{module}/design/2_TECHNICAL_DESIGN.md` — spec chi tiết
5. `.AIAgent/.github/context/shtl-architecture.md` — patterns
6. `/memories/repo/review-lessons.md` — common issues (if exists)

## Review Checklist

### 1. Spec Compliance (CRITICAL)
- [ ] Entity properties match Tech Design
- [ ] Service methods match Tech Design signatures
- [ ] Controller endpoints match Tech Design routes
- [ ] DTOs match Tech Design specs

### 2. Clean Architecture (MAJOR)
- [ ] Domain has NO dependencies on outer layers
- [ ] Application only depends on Domain
- [ ] Infrastructure implements Domain contracts
- [ ] Web depends on Application + Infrastructure

### 3. Repository Pattern (MAJOR)
- [ ] All queries parameterized (no SQL injection)
- [ ] Connection via IDbConnectionFactory
- [ ] Correct connection key (CoreAcc/CoreCnf/CoreStg/etc.)
- [ ] IsDeleted filter in SELECT queries

### 4. Service Pattern (MAJOR)
- [ ] Commands return ServiceResult or ServiceResult<T>
- [ ] Queries return DTOs (not entities)
- [ ] Exceptions caught and logged
- [ ] Audit fields set (CreatedBy, CreatedAt, UpdatedBy, UpdatedAt)

### 5. Controller Pattern (MAJOR)
- [ ] [Authorize] attribute on class
- [ ] [AuthorizeModule] on actions
- [ ] ModelState.IsValid checked
- [ ] [ValidateAntiForgeryToken] on POST
- [ ] ServiceResult checked for Success

### 6. Security Basics (CRITICAL)
- [ ] All queries parameterized
- [ ] Authorization checks present
- [ ] Data filtered by ChannelId
- [ ] No sensitive data in logs

### 7. Performance (MAJOR)
- [ ] No N+1 queries
- [ ] Pagination used for lists
- [ ] SELECT specific columns (not *)

## Review Process

### Wave-based Review
1. **Wave 1:** Review entities, repositories, DI registration
2. **Wave 2:** Review services, DTOs, error handling
3. **Wave 3:** Review controllers, authorization, validation

### Per Finding
```markdown
### CR-{NNN}: {Short Title}

**Severity:** 🔴 CRITICAL | 🟡 MAJOR | 🔵 MINOR | ℹ️ INFO

**File:** `{path/to/file.cs}`  
**Line:** {line number}

**Issue:** {Mô tả vấn đề}

**Evidence:**
```csharp
// Current code
{code snippet}
```

**Expected:** {Theo spec hoặc pattern}

**Fix:**
```csharp
// Suggested fix
{code snippet}
```
```

## Output
Tạo `.docs/{module}/quality/CODE_REVIEW_REPORT.md` với:
- Summary (file count, findings by severity)
- Verdict: ❌ FAIL | ⚠️ PASS WITH FIXES | ✅ PASS
- All findings với evidence
- Spec compliance table
- Recommendations

## Verdict Rules
| Verdict | Condition | Next Action |
|---------|-----------|-------------|
| ❌ FAIL | Có ≥1 🔴 CRITICAL | Fix loop → Backend Dev |
| ⚠️ PASS WITH FIXES | 0 🔴, có 🟡 MAJOR | Fix → verify → proceed |
| ✅ PASS | 0 🔴, 0 🟡 | Proceed to Security Review |

## Handoff
- If FAIL → Backend Developer với findings list
- If PASS WITH FIXES → Tech Lead verify fixes
- If PASS → Security Reviewer
