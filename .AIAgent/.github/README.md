# SHTL AI AGENT SYSTEM

> **Version:** 1.0 | **Date:** 12/04/2026
> **Purpose:** Multi-agent orchestration system for SHTL project development

---

## OVERVIEW

Hệ thống AI Agent cho dự án SHTL — Clean Architecture, .NET 8.0, Dapper, Multi-Database.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SHTL Project                         │
│  Clean Architecture: Domain → Application → Infra → Web │
│  Multi-DB: core_acc, core_cnf, core_stg, core_log, ... │
│  Tech Stack: .NET 8.0, Dapper, Bootstrap 5, jQuery     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Multi-Agent Pipeline                       │
│  PRE-DESIGN → DESIGN → IMPLEMENT → QUALITY → FINALIZE  │
└─────────────────────────────────────────────────────────┘
```

---

## QUICK START

### 1. Khởi tạo module mới

```
User: "Tạo module Notification để quản lý thông báo hệ thống"

Tech Lead:
1. Đọc agent-protocol.md
2. Tạo 1_PRD.md từ requirements
3. Handoff → Solution Architect

Solution Architect:
1. Thiết kế Entity, Service, Controller
2. Tạo 2_TECHNICAL_DESIGN.md
3. Handoff → Tech Lead

Tech Lead:
1. Tạo 3_IMPLEMENTATION_PLAN.md
2. Handoff → Design Reviewer → Backend Dev → Frontend Dev → Reviewers
```

### 2. Fix bug

```
User: "Fix lỗi: Document list không hiển thị đúng ChannelId"

Bug Fixer:
1. Đọc bug description
2. Trace code: Controller → Service → Repository
3. Identify root cause: Missing WHERE ChannelId filter
4. Fix SQL query
5. Verify build + manual test
6. Ghi BUG_FIX_LOG.md
```

---

## DIRECTORY STRUCTURE

```
.AIAgent/
├── .github/
│   ├── agents/                    # Agent definitions
│   │   ├── tech-lead.agent.md
│   │   ├── solution-architect.agent.md
│   │   ├── dev-backend.agent.md
│   │   ├── dev-frontend.agent.md
│   │   ├── code-reviewer.agent.md
│   │   ├── security-reviewer.agent.md
│   │   ├── qa-analyst.agent.md
│   │   ├── doc-writer.agent.md
│   │   ├── dev-bugfix.agent.md
│   │   └── ...
│   │
│   ├── context/                   # Shared knowledge
│   │   ├── agent-protocol.md      # Orchestration protocol
│   │   ├── shtl-architecture.md   # SHTL patterns & constraints
│   │   ├── reference-cache.md     # Code patterns (TODO)
│   │   └── common-frontend.md     # Bootstrap 5 + jQuery (TODO)
│   │
│   ├── prompts/                   # Agent prompts (TODO)
│   ├── skills/                    # Domain skills (TODO)
│   ├── templates/                 # Code templates (TODO)
│   ├── pipeline/                  # Pipeline config (TODO)
│   └── instructions/              # Coding standards (TODO)
│
└── README.md                      # This file

.docs/                             # Module documentation
├── {module}/
│   ├── design/
│   │   ├── 1_PRD.md
│   │   ├── 2_TECHNICAL_DESIGN.md
│   │   └── 3_IMPLEMENTATION_PLAN.md
│   ├── state/
│   │   └── MODULE_STATE.md
│   └── quality/
│       ├── CODE_REVIEW_REPORT.md
│       ├── SECURITY_REVIEW_REPORT.md
│       └── QA_REVIEW_REPORT.md

/memories/                         # Agent memory
├── session/                       # Current conversation
│   ├── current-module.md
│   └── task-progress.md
└── repo/                          # Long-term patterns
    ├── codebase-patterns.md
    ├── common-build-errors.md
    └── review-lessons.md
```

---

## AGENTS

### Core Pipeline Agents

| Agent | Role | Phase | Tools |
|-------|------|-------|-------|
| **Tech Lead** | Orchestrator, PRD, Plan, Release | ALL | read, edit, search, web, agent, todo |
| **Solution Architect** | Architecture, DB, Entity, Service Design | DESIGN | read, edit, search, agent, todo |
| **Backend Developer** | C# code: Entity, Repo, Service, Controller | IMPLEMENT | read, edit, execute, search, agent, todo |
| **Frontend Developer** | Razor Views, JS, Bootstrap 5 | IMPLEMENT | read, edit, execute, search, agent, todo |
| **Code Reviewer** | Code correctness, SRS, SHTL patterns | QUALITY | read, edit, search, agent, todo |
| **Security Reviewer** | OWASP, Auth, Data protection | QUALITY | read, edit, search, agent, todo |
| **QA Analyst** | Edge cases, Performance, N+1 | QUALITY | read, edit, search, agent, todo |
| **Doc Writer** | XML comments, API docs | FINALIZE | read, edit, search, agent, todo |

### Support Agents

| Agent | Role | When to Use |
|-------|------|-------------|
| **Bug Fixer** | Fix bugs outside pipeline | Manual test, deployment, customer bugs |
| **Security Scan Analyst** | Parse security reports | After security scan (Checkmarx, etc.) |
| **Security Fixer** | Fix CWE issues batch | After Security Scan Analyst creates plan |

---

## CORE CONCEPTS

### 1. State Management

Mỗi module có `MODULE_STATE.md` tracking progress:

```markdown
# MODULE STATE: Notification

**State Version:** 2.3.7
**Last updated:** 2026-04-12T10:30:00
**Current phase:** IMPLEMENT
**Current agent:** Backend Developer
**Blocker:** none

## Phase Progress
| Phase | Status | Agent(s) | Started | Completed |
|-------|--------|----------|---------|-----------|
| DESIGN — PRD | ✅ done | Tech Lead | 2026-04-12 | 2026-04-12 |
| DESIGN — Tech Design | ✅ done | Solution Architect | 2026-04-12 | 2026-04-12 |
| IMPLEMENT — Backend | 🔄 in-progress | Backend Developer | 2026-04-12 | — |
```

### 2. Memory Protocol

**Session Memory** (1 conversation):
- `/memories/session/current-module.md` — WIP context
- `/memories/session/task-progress.md` — Current tasks

**Repository Memory** (permanent):
- `/memories/repo/codebase-patterns.md` — Learned patterns
- `/memories/repo/common-build-errors.md` — Build fixes
- `/memories/repo/review-lessons.md` — Review patterns

### 3. Handoff Protocol

Agents communicate via structured JSON:

```json
{
  "handoff_id": "H-Notification-003",
  "from": "Solution Architect",
  "to": "Tech Lead",
  "module": "Notification",
  "phase_transition": "DESIGN → IMPLEMENT",
  "task": {
    "description": "Tech Design complete, create Implementation Plan",
    "acceptance_criteria": [
      "2_TECHNICAL_DESIGN.md exists",
      "All entities designed",
      "All service methods specified"
    ]
  }
}
```

### 4. Quality Gates

| Gate | Where | Criteria | Fail Action |
|------|-------|----------|-------------|
| **G1: Design Gate** | After DESIGN | Design Review = READY FOR DEV | Loop: Fix design |
| **G2: Build Gate** | After IMPLEMENT | `dotnet build` = 0 errors | Fix immediately |
| **G3: Code Review Gate** | QUALITY | Code Review = PASS | Loop: Fix code |
| **G4: Security Gate** | QUALITY | Security Review = 0 🔴 | Loop: Fix security |
| **G5: QA Gate** | QUALITY | QA Review = 0 🔴, ≤ 2 🟡 | Loop: Fix issues |
| **G6: Final Gate** | FINALIZE | ALL gates pass + docs | Tech Lead sign-off |

---

## SHTL-SPECIFIC PATTERNS

### Clean Architecture Layers

```
Web Layer (Controllers, Views)
    ↓ depends on
Application Layer (Services)
    ↓ depends on
Domain Layer (Entities, Contracts)
    ↑ implemented by
Infrastructure Layer (Repositories, Storage, Search, Identity)
```

### Multi-Database

| Schema | Purpose | Connection Key |
|--------|---------|----------------|
| `core_acc` | Account & Auth | `CoreAcc` |
| `core_cnf` | Configuration | `CoreCnf` |
| `core_stg` | Document Storage | `CoreStg` |
| `core_log` | Logging | `CoreLog` |
| `core_msg` | Messaging | `CoreMsg` |
| `core_catalog` | Catalog Data | `CoreCatalog` |

### Repository Pattern (Dapper)

```csharp
// Interface in Domain
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(int id);
    Task<int> InsertAsync(T entity);
}

// Implementation in Infrastructure
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

---

## COMMON WORKFLOWS

### New Module Development

```
1. User provides requirements
2. Tech Lead creates PRD
3. Solution Architect designs (Entity, Service, Controller, Views)
4. Tech Lead creates Implementation Plan
5. Design Reviewer validates design
6. Backend Developer implements (Entity → Repo → Service → Controller)
7. Frontend Developer implements (Views, JS)
8. Code Reviewer checks correctness
9. Security Reviewer checks security
10. QA Analyst checks quality
11. Doc Writer adds documentation
12. Tech Lead creates release notes
```

### Bug Fix

```
1. User reports bug
2. Bug Fixer traces code
3. Bug Fixer identifies root cause
4. Bug Fixer implements fix
5. Bug Fixer verifies (build + manual test)
6. Bug Fixer creates BUG_FIX_LOG.md
```

### Security Scan Response

```
1. Security scan tool generates report (PDF/HTML)
2. Security Scan Analyst parses report
3. Security Scan Analyst creates SECURITY_FIX_PLAN.md
4. Security Fixer fixes issues batch-by-batch
5. Security Fixer verifies each batch
6. Security Fixer creates SECURITY_FIX_LOG.md
```

---

## HARD CONSTRAINTS

### Technology Stack
- **Backend:** .NET 8.0, C# 12
- **Data Access:** Dapper (NOT Entity Framework)
- **Frontend:** ASP.NET Core MVC, Razor Views, Bootstrap 5, jQuery 3.x
- **Database:** SQL Server (multi-database)
- **Authentication:** Cookie-based (NOT JWT)
- **File Storage:** Local file system (NOT cloud)

### Architecture Rules
- ✅ Clean Architecture layers strictly enforced
- ✅ Domain layer has NO dependencies
- ✅ Repository pattern with Dapper
- ✅ Service pattern with ServiceResult<T>
- ✅ DTO pattern (never expose entities)
- ❌ NO Entity Framework
- ❌ NO direct database access from controllers
- ❌ NO business logic in controllers

### Security Rules
- ✅ All queries parameterized (SQL injection prevention)
- ✅ [Authorize] + [AuthorizeModule] on controllers
- ✅ Input validation (Data Annotations + server-side)
- ✅ CSRF protection ([ValidateAntiForgeryToken])
- ⚠️ Password security: PlaintextPasswordHasher (MUST migrate to BCrypt)

---

## TROUBLESHOOTING

### Build Errors

**"Cannot resolve service for type 'IRepository<T>'"**
```
Fix: Register in DataServiceExtensions.cs
services.AddScoped<IRepository<Document>, StgRepository>();
```

**"Connection string not found"**
```
Fix: Verify src/Web.Dashboard/config/connectionstrings.json exists
Check connection key: CoreAcc, CoreCnf, CoreStg, etc.
```

### Agent Issues

**Agent không response sau handoff**
```
1. Check MODULE_STATE.md — agent có nhận handoff không?
2. Check handoff JSON — acceptance_criteria rõ ràng không?
3. Retry với explicit prompt
```

**Quality gate loop > 3 vòng**
```
1. Escalate to Tech Lead
2. Phân loại failure type: TRANSIENT / FIXABLE / NEEDS_REPLAN / ESCALATE
3. Nếu NEEDS_REPLAN → Solution Architect sửa design
```

---

## NEXT STEPS

### TODO: Complete Agent System

- [ ] Create remaining agent files:
  - [ ] dev-frontend.agent.md
  - [ ] security-reviewer.agent.md
  - [ ] qa-analyst.agent.md
  - [ ] doc-writer.agent.md
  - [ ] dev-bugfix.agent.md
  - [ ] security-scan-analyst.agent.md
  - [ ] security-fixer.agent.md

- [ ] Create context files:
  - [ ] reference-cache.md (code patterns from existing modules)
  - [ ] common-frontend.md (Bootstrap 5 + jQuery API)

- [ ] Create skills:
  - [ ] shtl-build-diagnose (build error patterns)
  - [ ] shtl-security-patterns (CWE fix patterns)

- [ ] Create templates:
  - [ ] Entity.cs.template
  - [ ] Service.cs.template
  - [ ] Controller.cs.template
  - [ ] View.cshtml.template

### TODO: Index with GitNexus

```bash
cd E:\DATN\SHTLSource
npx gitnexus analyze
```

---

## SUPPORT

### Documentation
- **Agent Protocol:** `.AIAgent/.github/context/agent-protocol.md`
- **SHTL Architecture:** `.AIAgent/.github/context/shtl-architecture.md`
- **Project Architecture:** `ARCHITECTURE.md` (root)

### Contact
- **Project:** SHTL (Hệ thống số hóa tài liệu)
- **Architecture:** Clean Architecture, .NET 8.0, Multi-DB
- **Created:** 2026-04-12

---

**Version:** 1.0  
**Last Updated:** 2026-04-12
