---
name: architect-design
description: "Solution Architect: Design architecture, database, entities, services, controllers, views"
argument-hint: "Tên module (phải có sẵn .docs/{module}/design/1_PRD.md)"
agent: "Solution Architect"
---
Thiết kế kiến trúc và database cho module.

## Input
- **Tên module** — tìm `.docs/{module}/design/1_PRD.md`

Nếu PRD không tồn tại → DỪNG, yêu cầu Tech Lead tạo PRD trước.

## Bắt buộc đọc
1. `.AIAgent/.github/context/agent-protocol.md` — protocol
2. `.docs/{module}/state/MODULE_STATE.md` — verify DESIGN phase
3. `.docs/{module}/design/1_PRD.md` — requirements (INPUT BẮT BUỘC)
4. `.AIAgent/.github/context/shtl-architecture.md` — SHTL patterns
5. `/memories/repo/codebase-patterns.md` — lessons learned (if exists)

## Design Process

### Step 1: Phân tích AS-IS
1. Đọc PRD §2 (Hiện trạng)
2. Verify trong codebase:
   - Entities trong `src/Core.Domain/Entities/{Schema}/`
   - Services trong `src/Core.Application/Services/`
   - Controllers trong `src/Web.{Module}/Controllers/`
3. Xác định: **Tạo mới** vs **Mở rộng** vs **Giữ nguyên**

### Step 2: Architecture Decisions (ADR)
Với mỗi quyết định quan trọng, tạo ADR:
- New controller vs mở rộng controller cũ
- New service vs mở rộng service cũ
- Caching strategy (Redis, in-memory, no cache)
- Which database schema (core_acc / core_cnf / core_stg / core_log / core_msg / core_catalog)

### Step 3: Database/Entity Design
Với MỖI entity:
- Schema: core_{schema}
- Table name
- Inherits: BaseEntity
- Properties table (Property, Type, Nullable, MaxLength, Description, Notes)
- Indexes
- Business rules

### Step 4: DTO Design
- Response DTOs (for queries)
- Request DTOs (for commands: Create, Update)
- PaginatedResult usage

### Step 5: Service Design
- Interface methods (GetByIdAsync, GetPagedAsync, CreateAsync, UpdateAsync, DeleteAsync)
- Input/Output types
- Dependencies (repositories, ICurrentUser, ILogger)

### Step 6: Controller Design
- Actions table (Action, Route, Method, Return, Description)
- Authorization ([Authorize], [AuthorizeModule])
- Dependencies

### Step 7: View Design
- Index.cshtml (list with DataTables)
- Create.cshtml (form)
- Edit.cshtml (form)
- Detail.cshtml (readonly)

### Step 8: Cross-cutting Concerns
- Authentication & Authorization
- Multi-Database (connection key)
- File Storage (if applicable)
- Caching (if applicable)
- Logging

## Output
Tạo `.docs/{module}/design/2_TECHNICAL_DESIGN.md` với:
- §1: Architecture Decisions (ADRs)
- §2: Database Design (entities)
- §3: Data Transfer Objects (DTOs)
- §4: Application Layer (services)
- §5: Web Layer (controllers)
- §6: Views
- §7: Cross-cutting Concerns
- §8: Implementation Notes
- §9: Security Considerations

## Handoff
Khi hoàn thành:
1. Ghi `MODULE_STATE.md`: Phase = DESIGN — Tech Design ✅
2. Handoff → Tech Lead:
   ```json
   {
     "handoff_id": "H-{module}-002",
     "from": "Solution Architect",
     "to": "Tech Lead",
     "task": {
       "description": "Tech Design v1.0 complete. Create Implementation Plan.",
       "acceptance_criteria": [
         "2_TECHNICAL_DESIGN.md exists",
         "All entities designed",
         "All service methods specified",
         "All controller endpoints specified"
       ]
     }
   }
   ```
