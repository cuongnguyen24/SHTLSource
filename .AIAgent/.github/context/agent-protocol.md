# MULTI-AGENT ORCHESTRATION PROTOCOL — SHTL

> **Version:** 1.0 | **Date:** 12/04/2026
> **Mục đích:** Giao thức chung cho TẤT CẢ agents trong hệ thống SHTL. Mỗi agent PHẢI đọc file này tại BƯỚC 0.
> Định nghĩa: State management, Memory protocol, Handoff protocol, Quality gates.

---

## 1. KIẾN TRÚC MULTI-AGENT (14 Active Agents)

```
+--------------- PRE-DESIGN PHASE ------------+
¦  📋 Requirements Analyst (Document Parser)  ¦
¦    +→ 🔍 Solution Assessor (Gap Analysis)   ¦
+---------------------------------------------+
                    ↓ handoff
+--------------- DESIGN PHASE ----------------+
¦  🎯 Tech Lead (Orchestrator)                ¦
¦    +→ 🏗️ Solution Architect                 ¦
¦  📐 Design Reviewer (Design Gate)           ¦
+---------------------------------------------+
                    ↓ handoff
+--------------- IMPLEMENT PHASE -------------+
¦  💻 Backend Developer                       ¦
¦  🎨 Frontend Developer                      ¦
¦  🧪 Dev Unit Test                           ¦
+---------------------------------------------+
                    ↓ handoff
+--------------- QUALITY PHASE ---------------+
¦  👁️ Code Reviewer (Correctness/SRS/SHTL)    ¦
¦  🔒 Security Reviewer (OWASP/Auth/Data)     ¦
¦  ✅ QA Analyst (Edge Cases/Perf/N+1)        ¦
+---------------------------------------------+
                    ↓ handoff
+--------------- FINALIZE PHASE --------------+
¦  📝 Doc Writer (XML/API docs/DTO)           ¦
¦  🎯 Tech Lead (Release Notes/Final Gate)    ¦
+---------------------------------------------+

+------------ NGOÀI LUỒNG PIPELINE -----------+
¦  🐛 Bug Fixer (manual test / deployment /   ¦
¦     customer-reported / runtime bugs)       ¦
¦  🔐 Security Scan Analyst (parse report →   ¦
¦     classify → triage → FIX_PLAN)           ¦
¦  🛡️ Security Fixer (fix CWE batches →       ¦
¦     build verify → FIX_LOG)                 ¦
+---------------------------------------------+
```

### Agent Registry

| Agent | File | Vai trò chính | Tools |
|-------|------|---------------|-------|
| **Requirements Analyst** | `requirements-analyst.agent.md` | Parse raw docs → Structured requirements inventory | read, edit, search, web, todo |
| **Solution Assessor** | `solution-assessor.agent.md` | Gap analysis, readiness assessment, solution proposal | read, edit, search, agent, todo |
| **Tech Lead** | `tech-lead.agent.md` | Orchestrator: PRD, Plan, Handoff, Release | read, edit, search, web, agent, todo |
| **Solution Architect** | `solution-architect.agent.md` | Architecture, DB, Entity, Tech Design, Cross-cutting | read, edit, search, agent, todo |
| **Backend Developer** | `dev-backend.agent.md` | C# code: Entity, Repository, Service | read, edit, execute, search, agent, todo |
| **Frontend Developer** | `dev-frontend.agent.md` | Razor Views, JS, Bootstrap 5 | read, edit, execute, search, agent, todo |
| **Dev Unit Test** | `dev-unit-test.agent.md` | Manual testing guidance | read, edit, execute, search, agent, todo |
| **Code Reviewer** | `code-reviewer.agent.md` | Code correctness, SRS, SHTL compliance review | read, edit, search, agent, todo |
| **Design Reviewer** | `design-reviewer.agent.md` | Design docs review: SRS fidelity, tech correctness | read, edit, search, agent, todo |
| **Bug Fixer** | `dev-bugfix.agent.md` | Fix bugs NGOÀI LUỒNG pipeline | read, edit, execute, search, agent, todo |
| **Security Scan Analyst** | `security-scan-analyst.agent.md` | Parse security reports → classify → triage → SECURITY_FIX_PLAN | read, edit, search, web, agent, todo |
| **Security Fixer** | `security-fixer.agent.md` | Fix CWE issues batch-by-batch theo FIX_PLAN | read, edit, execute, search, agent, todo |
| **Security Reviewer** | `security-reviewer.agent.md` | OWASP, Authorization, Data protection | read, edit, search, agent, todo |
| **QA Analyst** | `qa-analyst.agent.md` | Edge cases, Performance, N+1, Caching | read, edit, search, agent, todo |
| **Doc Writer** | `doc-writer.agent.md` | XML comments, API docs, DTO descriptions | read, edit, search, agent, todo |

---

## 2. SHTL ARCHITECTURE CONTEXT

### 2.1 Clean Architecture Layers

```
┌─────────────────────────────────────────┐
│         Web Layer (MVC)                 │
│  Web.SoHoa, Web.Admin, Web.Account,    │
│  Web.Dashboard, Web.Uploader           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Application Layer                  │
│  Core.Application (Services)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Domain Layer                       │
│  Core.Domain (Entities, Contracts)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    Infrastructure Layer                 │
│  Infrastructure.Data (Dapper)           │
│  Infrastructure.Identity (Auth)         │
│  Infrastructure.Storage (Files)         │
│  Infrastructure.Search (Elasticsearch)  │
└─────────────────────────────────────────┘
```

### 2.2 Database Schemas (Multi-DB)

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `core_acc` | Account & Auth | users, roles, depts, user_roles, role_permissions |
| `core_cnf` | Configuration | channels, configs, content_types, record_types, sync_types, export_types |
| `core_stg` | Document Storage | documents, document_folders, form_cells, ocr_jobs, export_jobs |
| `core_log` | Logging | access_logs, action_logs, error_logs |
| `core_msg` | Messaging | notifications |
| `core_catalog` | Catalog Data | provinces, districts, wards |

### 2.3 Key Patterns

**Repository Pattern (Dapper):**
- Interface: `Core.Domain/Contracts/IRepository.cs`
- Implementation: `Infrastructure.Data/Repositories/{Schema}Repository.cs`
- Connection factory: `IDbConnectionFactory` với multi-DB support

**Service Pattern:**
- Application services trong `Core.Application/Services/`
- Inject repositories qua constructor
- Return `ServiceResult<T>` hoặc DTO

**Authentication:**
- Cookie-based auth (không JWT)
- `ICurrentUser` inject vào services
- `PlaintextPasswordHasher` (⚠️ security concern - cần migrate BCrypt)

**File Storage:**
- `IStorageService` → `LocalFileStorageService`
- Lưu file vào NAS/local path
- Trả public URL cho client

---

## 3. STATE MANAGEMENT PROTOCOL

### 3.1 Module State File

Mỗi module có file `.docs/{module}/state/MODULE_STATE.md` — single source of truth cho progress.

```markdown
# MODULE STATE: {Tên module}
**State Version:** {phase}.{gate}.{iteration}
**Last updated:** {timestamp}
**Current phase:** DESIGN | IMPLEMENT | QUALITY | FINALIZE | DONE
**Current agent:** {agent name}
**Blocker:** {mô tả hoặc "none"}

## Phase Progress
| Phase | Status | Agent(s) | Started | Completed |
|-------|--------|----------|---------|-----------|
| DESIGN — PRD | ✅ done | Tech Lead | 2026-04-12 | 2026-04-12 |
| DESIGN — Tech Design | ✅ done | Solution Architect | 2026-04-12 | 2026-04-12 |
| DESIGN — Impl Plan | ✅ done | Tech Lead | 2026-04-12 | 2026-04-12 |
| DESIGN — Review | ✅ pass | Design Reviewer | 2026-04-12 | 2026-04-12 |
| IMPLEMENT — Backend | 🔄 in-progress | Backend Developer | 2026-04-12 | — |
| IMPLEMENT — Frontend | ⏳ waiting | Frontend Developer | — | — |
| IMPLEMENT — Tests | ⏳ waiting | Dev Unit Test | — | — |
| QUALITY — Code Review | ⏳ waiting | Code Reviewer | — | — |
| QUALITY — Security | ⏳ waiting | Security Reviewer | — | — |
| QUALITY — QA/Perf | ⏳ waiting | QA Analyst | — | — |
| FINALIZE — Docs | ⏳ waiting | Doc Writer | — | — |
| FINALIZE — Release | ⏳ waiting | Tech Lead | — | — |

## Handoff Log
| # | From | To | Timestamp | Message |
|---|------|----|-----------|---------|
| 1 | Tech Lead | Solution Architect | 2026-04-12 | PRD v1.0 ready, proceed with Tech Design |

## Iteration Log
| # | Phase | Trigger | Result | Action |
|---|-------|---------|--------|--------|
| 1 | DESIGN | Design Review findings 3🟡 | NEEDS REVISION | Tech Lead fix → re-review |
```

### 3.2 State Versioning (MANDATORY)

**STATE_VERSION format:** `{phase}.{gate}.{iteration}`

| Component | Values | Example |
|-----------|--------|---------|
| `phase` | 0=PRE-DESIGN, 1=DESIGN, 2=IMPLEMENT, 3=QUALITY, 4=FINALIZE, 5=DONE | `2` |
| `gate` | 0=none, 1=G1, 2=G2, ..., 6=G6 | `3` |
| `iteration` | Sequential counter, incremented on every agent write | `7` |

**Rules:**
1. Mỗi agent write vào `MODULE_STATE.md` PHẢI increment `iteration` counter
2. Agent reads PHẢI ghi nhận version hiện tại — nếu version thay đổi giữa read và write → agent PHẢI re-read trước khi write
3. Khi phase transition → reset `gate` = 0, giữ `iteration` tăng liên tục

---

## 4. MEMORY PROTOCOL

### 4.1 Memory Scopes

| Scope | Path | Lifetime | Dùng cho |
|-------|------|----------|----------|
| **Session** | `/memories/session/` | 1 conversation | Task context đang làm, in-progress notes |
| **Repository** | `/memories/repo/` | Vĩnh viễn (repo) | Patterns học được, conventions đã verify, common issues |

### 4.2 Memory Entry Template (BẮT BUỘC cho /memories/repo/)

```markdown
### [{PatternId}] {Short Title}
- **Version:** {N} | **Status:** active | deprecated | blocked
- **Supersedes:** {PatternId cũ hoặc none}
- **Created:** {YYYY-MM-DD} | **Validated:** {YYYY-MM-DD}
- **Source:** {Module/file nơi phát hiện}
- **Pattern:** {Mô tả ngắn — what + why}
- **When to apply:** {Điều kiện áp dụng}
- **Action:** {Code sample hoặc instruction cụ thể}
```

**PatternId format:** `{scope}-{category}-{NNN}`
- Scope: `BLD` (build), `SEC` (security), `PERF` (performance), `UI` (frontend), `TEST` (test), `PAT` (pattern), `DOC` (doc)
- Ví dụ: `SEC-AUTH-003`, `PERF-N1-001`, `BLD-EF-002`

---

## 5. HANDOFF PROTOCOL

### 5.1 Structured Handoff Schema (JSON)

```json
{
  "handoff_id": "H-{module}-{sequential_number}",
  "from": "{Agent A name}",
  "to": "{Agent B name}",
  "timestamp": "{YYYY-MM-DDTHH:mm:ss}",
  "module": "{tên module}",
  "phase_transition": "{DESIGN → IMPLEMENT}",
  "task": {
    "description": "{Mô tả 1-2 câu: Agent B cần làm gì}",
    "scope": {
      "files_to_create": ["path/to/file1.cs", "path/to/file2.cshtml"],
      "files_to_modify": ["path/to/existing.cs"],
      "files_ready": ["path/completed/by/sender.cs"],
      "files_do_not_touch": ["path/to/locked.cs"]
    },
    "acceptance_criteria": [
      "{Tiêu chí 1 — cụ thể, verify được}",
      "{Tiêu chí 2 — cụ thể, verify được}"
    ],
    "constraints": [
      "{Ràng buộc 1}",
      "{Ràng buộc 2}"
    ]
  },
  "context": {
    "prd": ".docs/{module}/design/1_PRD.md",
    "tech_design": ".docs/{module}/design/2_TECHNICAL_DESIGN.md § {section}",
    "plan_tasks": ["TASK-{N}.{M}", "TASK-{N}.{M+1}"],
    "reference_module": "{ExistingModule}",
    "previous_findings": "{link to review report nếu là fix loop}"
  },
  "blocker": "{none hoặc mô tả cụ thể}"
}
```

---

## 6. QUALITY GATES

### 6.1 Gate Definitions

| Gate | Where | Criteria | Fail Action |
|------|-------|----------|-------------|
| **G1: Design Gate** | After DESIGN | Design Review = READY FOR DEV | Loop: Tech Lead/Arch fix → re-review |
| **G2: Build Gate** | After IMPLEMENT | `dotnet build` = 0 errors | Backend/Frontend fix immediately |
| **G3: Code Review Gate** | QUALITY | Code Review = PASS | Loop: Dev fix → re-review |
| **G4: Security Gate** | QUALITY | Security Review = 0 🔴 CRITICAL | Loop: Dev fix → sec re-review |
| **G5: QA Gate** | QUALITY | QA Review = 0 🔴, ≤ 2 🟡 | Loop: Dev fix → QA re-review |
| **G6: Final Gate** | FINALIZE | ALL gates pass + docs complete | Tech Lead sign-off |

### 6.2 Failure Recovery Taxonomy (4-tier)

| Failure Type | Ý nghĩa | Ví dụ | Action |
|-------------|---------|-------|--------|
| **TRANSIENT** | Lỗi tạm thời, không liên quan code | Build timeout, tool unavailable | Retry cùng agent, max 2 retries |
| **FIXABLE** | Lỗi logic có thể fix tại implementation | Missing field, wrong return type | Re-launch agent với failure context |
| **NEEDS_REPLAN** | Design sai → code sai | Entity thiếu field trong Tech Design | Escalate lên Solution Architect → sửa design → re-implement |
| **ESCALATE** | Vượt scope agent, cần quyết định business | SRS conflict, architecture change | Notify Tech Lead → User decision required |

---

## 7. FILE ENCODING SAFETY (MANDATORY)

### 7.1 Safe vs. Unsafe File Edit Methods

| Method | Vietnamese-safe? | Notes |
|--------|-----------------|-------|
| `replace_string_in_file` tool | ✅ SAFE | Always UTF-8, BOM-aware |
| `create_file` tool | ✅ SAFE | Always UTF-8 |
| PowerShell `Set-Content $f $content -Encoding UTF8` | ✅ SAFE | Explicit only |
| PowerShell `[IO.File]::WriteAllText($f, $text, $utf8Bom)` | ✅ SAFE | Preferred for .cs/.cshtml/.md |
| PowerShell `Set-Content $f $content` (**no -Encoding**) | ❌ CORRUPTS | Defaults to ANSI |
| PowerShell `$content > $file` | ❌ CORRUPTS | UTF-16 LE redirect |

**RULE:** NEVER generate PowerShell code that writes source files (`.cs`, `.cshtml`, `.md`, `.json`, `.js`) without explicit `-Encoding UTF8`.

### 7.2 UTF-8 Verification Gate (MANDATORY)

After EVERY batch of file edits:
1. `dotnet build` → 0 compile errors
2. For each `.cs`, `.cshtml`, `.js`, `.md` file modified:
   - Grep pattern `Ã|á»|áº|Äƒ|Ä'|Æ¡` scoped to that file
   - If ANY match → STOP, fix encoding immediately
3. If agent used PowerShell to write files:
   - Verify command included `-Encoding UTF8`
   - If missing → re-write file with correct encoding

**Failure = BLOCKER:** Do NOT handoff to next agent until UTF-8 gate passes.

---

## 8. CONVENTIONS

### 8.1 Severity Scale

| Level | Icon | Ý nghĩa | Action |
|-------|------|---------|--------|
| CRITICAL | 🔴 | Build-breaking / security hole / data loss | MUST fix |
| MAJOR | 🟡 | Logic sai / pattern vi phạm / SRS miss | SHOULD fix |
| MINOR | 🔵 | Naming / style / minor optimization | COULD fix |
| INFO | ℹ️ | Suggestion / observation | Optional |

### 8.2 Report Verdicts

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| ✅ PASS | 0 🔴, 0 🟡 | Proceed to next phase |
| ⚠️ PASS WITH FIXES | 0 🔴, có 🟡 | Fix → re-review |
| ❌ FAIL | Có 🔴 | Fix → re-review (mandatory) |

---

## 9. CONTEXT SHARING

Tất cả agents chia sẻ knowledge qua `.AIAgent/.github/context/`:

| File | Nội dung | Agents sử dụng |
|------|----------|-----------------|
| `shtl-architecture.md` | Clean Architecture layers, DB schemas, patterns | All agents |
| `reference-cache.md` | Pattern code (Entity, Repo, Service, Controller, View) | Backend, Frontend, Code Reviewer |
| `common-frontend.md` | Bootstrap 5, jQuery API | Frontend, Code Reviewer |
| `agent-protocol.md` | **File này** — Orchestration protocol | TẤT CẢ agents |

---

**END OF PROTOCOL**
