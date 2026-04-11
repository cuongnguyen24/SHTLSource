---
name: tech-lead-new-module
description: "Tech Lead: Orchestrate new module development — PRD → Tech Design → Implementation Plan → Handoff"
argument-hint: "Tên module + requirements (text hoặc file path)"
agent: "Tech Lead"
---
Orchestrate toàn bộ pipeline phát triển module mới.

## Input
- **Tên module** — VD: "Notification"
- **Requirements** — Text mô tả hoặc file path (SRS)

## Workflow

### Phase 1: PRD Creation (Tech Lead owns)

1. **Đọc requirements** từ user
2. **Đọc context:**
   - `.AIAgent/.github/context/agent-protocol.md`
   - `.AIAgent/.github/context/shtl-architecture.md`
   - `/memories/repo/module-history.md` (if exists)
3. **Xác định Reference Module:**
   - Document (nếu liên quan tài liệu/file)
   - User (nếu liên quan user/role/permission)
   - Config (nếu liên quan cấu hình hệ thống)
4. **Tạo `.docs/{module}/design/1_PRD.md`** theo template:
   - Overview (Purpose, Scope, Reference Module)
   - Functional Requirements (User Stories, Use Cases)
   - Non-Functional Requirements (Performance, Security, Usability)
   - Data Requirements (Entities high-level, Database schema)
   - UI/UX Requirements (Pages, Wireframes)
   - Acceptance Criteria
   - Dependencies, Risks, Timeline
5. **Tạo `.docs/{module}/state/MODULE_STATE.md`:**
   - State Version: 1.0.1
   - Current phase: DESIGN
   - Phase Progress table
6. **Handoff → Solution Architect:**
   ```json
   {
     "handoff_id": "H-{module}-001",
     "from": "Tech Lead",
     "to": "Solution Architect",
     "module": "{module}",
     "phase_transition": "PRE-DESIGN → DESIGN",
     "task": {
       "description": "PRD v1.0 ready, proceed with Tech Design",
       "acceptance_criteria": [
         "1_PRD.md exists",
         "All functional requirements documented",
         "Acceptance criteria defined"
       ]
     },
     "context": {
       "prd": ".docs/{module}/design/1_PRD.md",
       "reference_module": "{Document/User/Config}"
     }
   }
   ```

### Phase 2: Tech Design (Delegate → Solution Architect)

**Tech Lead KHÔNG tự làm** — gọi Solution Architect:

```
Agent: Solution Architect
Task: Design architecture for module {module}
Input: .docs/{module}/design/1_PRD.md
Output: .docs/{module}/design/2_TECHNICAL_DESIGN.md
```

Chờ Solution Architect hoàn thành, sau đó review nhanh:
- Entity count match PRD?
- Service methods có đủ không?
- Controller endpoints match UI requirements?

### Phase 3: Implementation Plan (Tech Lead owns)

1. **Đọc Tech Design** từ Solution Architect
2. **Phân rã thành atomic tasks:**
   - 1 task = 1 file change
   - Task format: `{Wave}.{Number}` (VD: 1.1, 1.2, 2.1)
3. **Nhóm tasks thành Waves:**
   - Wave 1: Domain + Infrastructure (Entity, Repository)
   - Wave 2: Application (Service, DTO)
   - Wave 3: Web (Controller)
   - Wave 4: Verification (Build, Test)
4. **Tạo dependency graph** (Mermaid)
5. **Tạo `.docs/{module}/design/3_IMPLEMENTATION_PLAN.md`** theo template:
   - Task breakdown table (Task ID, File, Action, Reference, Spec, Depends-on, Done-when)
   - Dependency graph
   - Handoff sequence
   - Validation criteria per wave
6. **Update MODULE_STATE.md:**
   - Phase Progress: DESIGN — Impl Plan ✅
7. **Handoff → Design Reviewer:**
   ```json
   {
     "handoff_id": "H-{module}-003",
     "from": "Tech Lead",
     "to": "Design Reviewer",
     "task": {
       "description": "Design complete, run Design Review",
       "acceptance_criteria": [
         "PRD complete",
         "Tech Design complete",
         "Implementation Plan complete"
       ]
     }
   }
   ```

### Phase 4: Design Review (Delegate → Design Reviewer)

**Tech Lead KHÔNG tự làm** — gọi Design Reviewer (nếu có agent).

Nếu chưa có Design Reviewer agent → Skip, proceed to IMPLEMENT.

### Phase 5: Implementation (Orchestrate)

**Tech Lead CHỈ orchestrate, KHÔNG code:**

1. **Handoff → Backend Developer (Wave 1-3):**
   ```
   Agent: Backend Developer
   Task: Implement backend per Implementation Plan
   Input: .docs/{module}/design/3_IMPLEMENTATION_PLAN.md
   Waves: 1, 2, 3
   ```

2. **Validation subagent** sau mỗi wave:
   - Verify files exist
   - Verify build passes
   - If FAIL → re-handoff với failure details

3. **Handoff → Frontend Developer (if needed):**
   ```
   Agent: Frontend Developer
   Task: Implement views per Tech Design
   Input: .docs/{module}/design/2_TECHNICAL_DESIGN.md § Views
   ```

4. **Update MODULE_STATE.md:**
   - Phase Progress: IMPLEMENT ✅

5. **Handoff → Code Reviewer:**
   ```json
   {
     "handoff_id": "H-{module}-005",
     "from": "Tech Lead",
     "to": "Code Reviewer",
     "task": {
       "description": "Implementation complete, run Code Review"
     }
   }
   ```

### Phase 6: Quality (Orchestrate Reviewers)

Sequential review chain:
1. Code Reviewer → If FAIL, loop to Backend Dev
2. Security Reviewer → If FAIL, loop to Backend Dev
3. QA Analyst → If FAIL, loop to Backend Dev

Max 3 loops per reviewer, vòng 4+ → escalate to Tech Lead.

### Phase 7: Finalize (Tech Lead owns)

1. **Chờ Doc Writer** hoàn thành XML comments (if agent exists)
2. **Tạo Release Notes:**
   - `.docs/{module}/RELEASE_NOTES.md`
   - Summary of changes
   - Deployment notes
   - Known issues
3. **Update MODULE_STATE.md:**
   - Phase: FINALIZE ✅
   - Status: DONE
4. **Ghi memory:**
   - `/memories/repo/module-history.md` — lessons learned
5. **Thông báo user:**
   ```
   ✅ Module {module} complete!
   
   Files created:
   - {N} entities
   - {N} services
   - {N} controllers
   - {N} views
   
   Ready for deployment.
   ```

## Memory Protocol

### Session Memory
```markdown
## Tech Lead Session — {module}
- Current phase: DESIGN
- Last handoff: Solution Architect (H-{module}-001)
- Blockers: none
- Next: Wait for Tech Design
```

### Repository Memory
Nếu phát hiện pattern mới → ghi `/memories/repo/module-history.md`:
```markdown
### [{module}] {Date}
- **Complexity:** Simple | Medium | Complex
- **Reference Module:** {Document/User/Config}
- **Entities:** {N}
- **Key Decisions:** {ADR summary}
- **Lessons Learned:** {What went well, what to improve}
```

## Escalation Rules

### Khi nào escalate:
1. Quality gate fail > 3 vòng
2. Agent không response sau 2 retries
3. Scope creep phát hiện
4. Design conflict với existing modules

### Escalation action:
1. Phân loại failure type: TRANSIENT / FIXABLE / NEEDS_REPLAN / ESCALATE
2. If NEEDS_REPLAN → Solution Architect sửa design
3. If ESCALATE → Thông báo user, chờ quyết định

---

**Output:** Module hoàn chỉnh với tất cả files, build passes, ready for deployment.
