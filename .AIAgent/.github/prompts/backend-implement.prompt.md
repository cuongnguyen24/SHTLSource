---
name: backend-implement
description: "Backend Developer: Implement C# backend — Entity, Repository, Service, Controller, DI theo Implementation Plan"
argument-hint: "Tên module (phải có sẵn .docs/{module}/design/3_IMPLEMENTATION_PLAN.md). Optionally: wave/task cụ thể"
agent: "Backend Developer"
---
Implement C# backend code theo Implementation Plan.

## Input
- **Tên module** — tìm `.docs/{module}/design/`
- **Wave** (nếu chỉ định): "Wave 1 only", "Wave 1-2"
- **Task** (nếu chỉ định): "Task 2.3 only"

Nếu `3_IMPLEMENTATION_PLAN.md` không tồn tại → DỪNG, yêu cầu chạy Tech Lead trước.

## Bắt buộc đọc
1. `.AIAgent/.github/context/agent-protocol.md` — protocol
2. `.docs/{module}/state/MODULE_STATE.md` — verify IMPLEMENT phase
3. `.AIAgent/.github/context/shtl-architecture.md` — SHTL patterns
4. `.AIAgent/.github/context/reference-cache.md` — code patterns
5. `.docs/{module}/design/3_IMPLEMENTATION_PLAN.md` — task list
6. `.docs/{module}/design/2_TECHNICAL_DESIGN.md` — specs

> ⚠️ **Hard Constraints:** Đã định nghĩa trong agent file. Agent sẽ tự tuân thủ .NET 8.0, Clean Architecture, Dapper patterns.

## Wave-based Implementation

### Wave 1: Domain + Infrastructure
```
Tasks: 1.1 - 1.N
- Create entities in Core.Domain/Entities/{Schema}/
- Create repository interfaces in Core.Domain/Contracts/
- Implement repositories in Infrastructure.Data/Repositories/
- Register in DataServiceExtensions.cs
- Build verify: dotnet build
```

### Wave 2: Application
```
Tasks: 2.1 - 2.N
- Create DTOs in Shared.Contracts/
- Implement services in Core.Application/Services/
- Register in AppServiceExtensions.cs
- Build verify: dotnet build
```

### Wave 3: Web
```
Tasks: 3.1 - 3.N
- Create controllers in Web.{Module}/Controllers/
- Add authorization attributes
- Implement actions (GET/POST)
- Build verify: dotnet build
```

## Session Memory
Ghi `/memories/session/task-progress.md`:
```
- Current wave: 2
- Current task: 2.4
- Last build: ✅ 0 errors
- Files created: [✅] Entity.cs, [✅] Repository.cs, [❌] Service.cs
- Known blockers: none
```

## Build Verification
Sau mỗi wave:
```powershell
cd E:\DATN\SHTLSource\src
dotnet build
```

Nếu có lỗi → đọc skill `shtl-build-diagnose` để fix.

## Handoff
Khi hoàn thành:
1. Ghi `MODULE_STATE.md`: Phase = IMPLEMENT — Backend ✅
2. Tạo handoff JSON cho Tech Lead
3. List files created/modified
4. Confirm build passes (0 errors)
