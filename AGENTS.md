# AGENTS.md — SHTL Project

> **GitNexus Integration:** This file tells Cursor/Claude about the AI agent system and GitNexus code intelligence.

---

## GITNEXUS STATUS

**Repository:** SHTLSource  
**Indexed:** 2026-04-09  
**Last Commit:** 046d640279d61b6273a3f011925fa6c4351872ea  
**Stats:**
- Files: 602
- Nodes: 2,852
- Edges: 7,137
- Communities: 166
- Processes: 205

### GitNexus Tools Available

When working with this codebase, you have access to GitNexus MCP tools:

| Tool | Purpose | Example |
|------|---------|---------|
| `user-gitnexus-query` | Find code by meaning | "How does document workflow work?" |
| `user-gitnexus-context` | 360° view of symbol | context({name: "DocumentService"}) |
| `user-gitnexus-impact` | Blast radius analysis | impact({target: "Document", direction: "upstream"}) |
| `user-gitnexus-detect_changes` | Analyze uncommitted changes | detect_changes({scope: "unstaged"}) |
| `user-gitnexus-rename` | Safe refactoring | rename({symbol_name: "GetDocuments", new_name: "GetDocumentList"}) |

**When to use GitNexus:**
- ✅ Understanding unfamiliar code ("How does X work?")
- ✅ Finding all callers/callees of a function
- ✅ Impact analysis before refactoring
- ✅ Tracing execution flows
- ❌ Simple file reads (use Read tool)
- ❌ Exact text search (use Grep tool)

---

## AI AGENT SYSTEM

### Overview

SHTL uses a **multi-agent orchestration system** for development:

```
PRE-DESIGN → DESIGN → IMPLEMENT → QUALITY → FINALIZE
```

### Active Agents

| Agent | File | Role |
|-------|------|------|
| **Tech Lead** | `.AIAgent/.github/agents/tech-lead.agent.md` | Orchestrator, PRD, Plan, Release |
| **Solution Architect** | `.AIAgent/.github/agents/solution-architect.agent.md` | Architecture, DB, Entity, Service Design |
| **Backend Developer** | `.AIAgent/.github/agents/dev-backend.agent.md` | C# code: Entity, Repo, Service, Controller |
| **Code Reviewer** | `.AIAgent/.github/agents/code-reviewer.agent.md` | Code correctness, SRS, SHTL patterns |

**TODO:** Create remaining agents (Frontend, Security, QA, Doc Writer, Bug Fixer)

### Core Protocol

**MANDATORY:** All agents MUST read `.AIAgent/.github/context/agent-protocol.md` at STEP 0.

Key concepts:
- **State Management:** `MODULE_STATE.md` tracks progress
- **Memory Protocol:** Session + Repository memory
- **Handoff Protocol:** Structured JSON between agents
- **Quality Gates:** 6 gates (Design, Build, Code Review, Security, QA, Final)

---

## SHTL ARCHITECTURE

### Clean Architecture Layers

```
Web (Controllers, Views)
  ↓
Application (Services)
  ↓
Domain (Entities, Contracts)
  ↑
Infrastructure (Repositories, Storage, Search, Identity)
```

**Dependency Rule:** Inner layers NEVER depend on outer layers.

### Multi-Database

| Schema | Purpose | Connection Key |
|--------|---------|----------------|
| `core_acc` | Account & Auth | `CoreAcc` |
| `core_cnf` | Configuration | `CoreCnf` |
| `core_stg` | Document Storage | `CoreStg` |
| `core_log` | Logging | `CoreLog` |
| `core_msg` | Messaging | `CoreMsg` |
| `core_catalog` | Catalog Data | `CoreCatalog` |

### Technology Stack

- **Backend:** .NET 8.0, C# 12
- **Data Access:** Dapper (NOT Entity Framework)
- **Frontend:** ASP.NET Core MVC, Razor, Bootstrap 5, jQuery
- **Database:** SQL Server (multi-database)
- **Auth:** Cookie-based (NOT JWT)
- **Storage:** Local file system

---

## KEY PATTERNS

### Repository Pattern (Dapper)

```csharp
// Domain contract
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(int id);
    Task<int> InsertAsync(T entity);
}

// Infrastructure implementation
public class StgRepository : IRepository<Document>
{
    private readonly IDbConnectionFactory _connectionFactory;
    
    public async Task<Document?> GetByIdAsync(int id)
    {
        using var conn = _connectionFactory.CreateConnection("CoreStg");
        return await conn.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM core_stg.documents WHERE Id = @Id AND IsDeleted = 0",
            new { Id = id });
    }
}
```

### Service Pattern

```csharp
public class DocumentService
{
    public async Task<ServiceResult<int>> CreateAsync(CreateDocumentRequest request)
    {
        try
        {
            var document = new Document 
            { 
                ChannelId = request.ChannelId,
                CreatedBy = _currentUser.UserId,
                CreatedAt = DateTime.UtcNow
            };
            
            var id = await _documentRepo.InsertAsync(document);
            return ServiceResult<int>.Success(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create document");
            return ServiceResult<int>.Failure("Tạo tài liệu thất bại");
        }
    }
}
```

### Controller Pattern

```csharp
[Authorize]
[AuthorizeModule(ModuleCode = "DOC_SCAN")]
public class DocumentController : Controller
{
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateDocumentRequest request)
    {
        if (!ModelState.IsValid)
            return View(request);
        
        var result = await _documentService.CreateAsync(request);
        
        if (!result.Success)
        {
            ModelState.AddModelError("", result.ErrorMessage ?? "Lỗi");
            return View(request);
        }
        
        TempData["SuccessMessage"] = "Tạo thành công";
        return RedirectToAction(nameof(Index));
    }
}
```

---

## HARD CONSTRAINTS

### Architecture
- ✅ Clean Architecture layers strictly enforced
- ✅ Domain layer has NO dependencies
- ✅ Repository pattern with Dapper
- ✅ Service pattern with ServiceResult<T>
- ❌ NO Entity Framework
- ❌ NO business logic in controllers

### Security
- ✅ All queries parameterized (SQL injection prevention)
- ✅ [Authorize] + [AuthorizeModule] on controllers
- ✅ Input validation (Data Annotations + server-side)
- ⚠️ **CRITICAL:** PlaintextPasswordHasher used (MUST migrate to BCrypt)

### Performance
- ✅ Pagination for all list queries
- ✅ Avoid N+1 queries (use JOIN)
- ✅ Connection pooling enabled
- ❌ NO lazy loading

---

## WORKFLOW SYSTEM

### Document Workflow Steps

```
Scan → CheckScan1 → CheckScan2 → Zoning → OCR → Extract 
  → Check1 → Check2 → CheckFinal → CheckLogic → Export → Done
```

### Workflow Flags

Each `Document` entity has boolean flags:
- `IsCheckScan1Done`, `IsCheckScan2Done`
- `IsZoningDone`, `IsOcrDone`, `IsExtractDone`
- `IsCheck1Done`, `IsCheck2Done`, `IsCheckFinalDone`, `IsCheckLogicDone`
- `IsExportDone`

---

## COMMON TASKS

### Create New Module

```
1. User: "Tạo module Notification"
2. Tech Lead: Create PRD
3. Solution Architect: Design (Entity, Service, Controller, Views)
4. Tech Lead: Create Implementation Plan
5. Backend Developer: Implement C# code
6. Frontend Developer: Implement Views
7. Code Reviewer: Review code
8. Security Reviewer: Review security
9. QA Analyst: Review quality
10. Doc Writer: Add documentation
```

### Fix Bug

```
1. User: "Fix lỗi: Document list không hiển thị"
2. Bug Fixer: Trace code
3. Bug Fixer: Identify root cause
4. Bug Fixer: Implement fix
5. Bug Fixer: Verify (build + test)
```

### Refactor Code

```
1. User: "Rename GetDocuments to GetDocumentList"
2. Use GitNexus: user-gitnexus-rename
3. Verify: user-gitnexus-detect_changes
4. Build verify: dotnet build
```

---

## DOCUMENTATION

### Agent System
- **Protocol:** `.AIAgent/.github/context/agent-protocol.md`
- **Architecture:** `.AIAgent/.github/context/shtl-architecture.md`
- **README:** `.AIAgent/.github/README.md`

### Project
- **Architecture:** `ARCHITECTURE.md` (root)
- **Database:** `db/README.md`
- **Connection Strings:** `src/Web.Dashboard/config/README.md`

---

## NEXT STEPS

### Complete Agent System
- [ ] Create remaining agent files (Frontend, Security, QA, etc.)
- [ ] Create reference-cache.md (code patterns)
- [ ] Create common-frontend.md (Bootstrap 5 + jQuery)
- [ ] Create skills (build-diagnose, security-patterns)
- [ ] Create templates (Entity, Service, Controller, View)

### Re-index with GitNexus
```bash
cd E:\DATN\SHTLSource
npx gitnexus analyze
```

---

**Version:** 1.0  
**Created:** 2026-04-12  
**Last Updated:** 2026-04-12
