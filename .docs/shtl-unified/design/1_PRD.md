# PRD: SHTL Admin + SoHoa Unified System

**Version:** 1.0  
**Date:** 2026-04-12  
**Author:** Tech Lead (via AI Agent System)  
**Status:** APPROVED

---

## 1. OVERVIEW

### 1.1 Purpose
Xây dựng hệ thống quản lý tài liệu số hóa (SoHoa) và quản trị hệ thống (Admin) thống nhất, nơi tất cả các module tương tác đúng logic, đủ tính năng và pass qua tất cả quality gates.

### 1.2 Scope
**In scope:**
- **Admin Module:** User, Role, Dept, Position, Team, Permission, Config, Log, ExportType
- **SoHoa Module:** Scan, CheckScan1/2, Zone/OCR, Extract, Check1/2/Final/Logic, Export, SyncUpload, Folders
- **Unified Features:** Authentication, Authorization (RBAC), Logging, Notification, Search

**Out of scope:**
- Dashboard reporting (giữ nguyên)
- Plugin system (giữ nguyên)

### 1.3 Reference Module
- **Primary:** Document (SoHoa core)
- **Reason:** Document workflow là core business logic, tất cả các module khác phục vụ nó

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 Admin Features

#### 2.1.1 User Management
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| AD-1 | Admin | Quản lý user (CRUD) | Quản lý người dùng hệ thống |
| AD-2 | Admin | Gán user vào dept/team | Phân quyền theo đơn vị |
| AD-3 | Admin | Đặt password/reset password | Bảo mật tài khoản |
| AD-4 | Admin | Kích hoạt/vô hiệu user | Quản lý trạng thái |

#### 2.1.2 Role & Permission
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| AD-5 | Admin | Quản lý roles (CRUD) | Phân quyền theo nhóm |
| AD-6 | Admin | Gán permissions cho role | Quản lý chi tiết quyền |
| AD-7 | Admin | Gán user vào roles | User có nhiều quyền |
| AD-8 | System | Lọc dữ liệu theo ChannelId | Multi-tenant isolation |

#### 2.1.3 Department & Team
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| AD-9 | Admin | Quản lý dept (CRUD) | Tổ chức theo phòng ban |
| AD-10 | Admin | Quản lý team (CRUD) | Nhóm công việc |
| AD-11 | Admin | Gán user vào dept/team | Liên kết user-vị trí |

#### 2.1.4 System Configuration
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| AD-12 | Admin | Quản lý content types | Loại tài liệu |
| AD-13 | Admin | Quản lý record types | Loại hồ sơ |
| AD-14 | Admin | Quản lý sync types | Loại đồng bộ |
| AD-15 | Admin | Quản lý export types | Cấu hình xuất |
| AD-16 | Admin | Quản lý system config | Cấu hình hệ thống |

#### 2.1.5 Logging & Audit
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| AD-17 | Admin | Xem access logs | Theo dõi đăng nhập |
| AD-18 | Admin | Xem action logs | Theo dõi thao tác |
| AD-19 | Admin | Xem chi tiết action | Debug khi cần |

### 2.2 SoHoa Features

#### 2.2.1 Scan & Upload
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-1 | User | Upload tài liệu mới | Bắt đầu workflow |
| SH-2 | User | Xem danh sách scan | Quản lý tài liệu |
| SH-3 | Staff | Kiểm tra Scan 1 | Xác nhận scan chất lượng |
| SH-4 | Staff | Kiểm tra Scan 2 | Xác nhận lần 2 |
| SH-5 | User | Xóa tài liệu lỗi | Dọn dẹp |

#### 2.2.2 Zone & OCR
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-6 | System | Tự động zone | Phân vùng tự động |
| SH-7 | System | Tự động OCR | Nhận dạng text |
| SH-8 | User | Fix OCR errors | Sửa lỗi OCR |

#### 2.2.3 Extract (Nhập liệu)
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-9 | Staff | Nh��p liệu từ form | Nhập liệu thủ công |
| SH-10 | Staff | Preview tài liệu | Xem trước khi lưu |
| SH-11 | Staff | Submit form data | Lưu dữ liệu |

#### 2.2.4 Quality Check
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-12 | Staff | Kiểm tra Check 1 | Dữ liệu đúng |
| SH-13 | Staff | Kiểm tra Check 2 | Dữ liệu lần 2 |
| SH-14 | Staff | Kiểm tra Final | Duyệt cuối |
| SH-15 | Expert | Kiểm tra Logic | Duyệt nghiệp vụ |

#### 2.2.5 Export
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-16 | User | Tạo yêu cầu export | Xuất tài liệu |
| SH-17 | User | Download kết quả | Nhận file export |
| SH-18 | Admin | Quản lý export types | Cấu hình xuất |

#### 2.2.6 Sync Upload
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| SH-19 | System | Sync upload từ folder | Upload tự động |
| SH-20 | User | Monitor sync status | Theo dõi tiến trình |
| SH-21 | Admin | Quản lý sync types | Cấu hình sync |

### 2.3 Unified Features

#### 2.3.1 Authentication
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| UN-1 | User | Login/logout | Truy cập hệ thống |
| UN-2 | User | Đổi password | Bảo mật |
| UN-3 | System | Session timeout | Hết hạn tự động |

#### 2.3.2 Authorization (RBAC)
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| UN-4 | Admin | Kiểm tra quyền | Cho phép/truy cập |
| UN-5 | User | Xem module được phép | Biết quyền hạn |
| UN-6 | System | Lọc data theo ChannelId | Multi-tenant |

#### 2.3.3 Notification
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| UN-7 | User | Nhận thông báo | Biết có việc |
| UN-8 | User | Đánh dấu đã đọc | Xóa thông báo |

#### 2.3.4 Search
| ID | As a | I want to | So that |
|----|------|-----------|---------|
| UN-9 | User | Tìm kiếm tài liệu | Nhanh chóng |
| UN-10 | User | Filter kết quả | Thu hẹp tìm kiếm |

---

## 3. NON-FUNCTIONAL REQUIREMENTS

### 3.1 Performance
- List view: Load < 2s cho 1000 records
- Form submit: Response < 1s
- Search: < 3s với Elasticsearch

### 3.2 Security
- ✅ Password: BCrypt hashing (workFactor ≥ 12)
- ✅ Authorization: Module-based permission check
- ✅ Input validation: All user input sanitized
- ✅ SQL injection: Parameterized queries (Dapper)
- ✅ XSS: HTML encoding in views
- ✅ CSRF: AntiForgeryToken on all POST

### 3.3 Usability
- Response design (Bootstrap 5)
- Vietnamese language support
- Error messages: User-friendly

### 3.4 Reliability
- Logging: All CUD operations
- Error handling: ServiceResult pattern
- Audit trail: Action logs

---

## 4. DATA REQUIREMENTS

### 4.1 Entities by Schema

**core_acc (Account):**
- User, Role, Dept, Position, Team, UserRole, UserDept, UserTeam, ModulePermission

**core_cnf (Configuration):**
- Channel, ContentType, RecordType, SyncType, ExportType, Config, Translation

**core_stg (Storage):**
- Document, DocumentFolder, FormCell, QueueEntities

**core_log (Logging):**
- AccessLog, ActionLog, ErrorLog

**core_msg (Messaging):**
- Notification

### 4.2 Database Schemas
- **6 schemas:** core_acc, core_cnf, core_stg, core_log, core_msg, core_catalog

---

## 5. UI/UX REQUIREMENTS

### 5.1 Admin Pages
| Page | URL | Description |
|------|-----|-------------|
| User List | /Admin/User | Danh sách user |
| User Create/Edit | /Admin/User/Create, /Admin/User/Edit/{id} | Form user |
| Role List | /Admin/Role | Danh sách role |
| Role Edit | /Admin/Role/Edit/{id} | Form role + permissions |
| Dept List | /Admin/Dept | Danh sách dept |
| Config | /Admin/Config | System config |
| Log - Access | /Admin/Log/Login | Access logs |
| Log - Action | /Admin/Log/Action | Action logs |

### 5.2 SoHoa Pages
| Page | URL | Description |
|------|-----|-------------|
| Scan List | /SoHoa/Scan | Danh sách scan |
| Check Scan | /SoHoa/Scan/CheckScan1, /CheckScan2 | Check scan forms |
| Extract | /SoHoa/Extract/Form/{id} | Form nhập liệu |
| Check 1 | /SoHoa/Check/Check1 | Check step 1 |
| Check 2 | /SoHoa/Check/Check2 | Check step 2 |
| Check Final | /SoHoa/Check/CheckFinal | Final check |
| Check Logic | /SoHoa/Check/CheckLogic | Logic check |
| Export | /SoHoa/Export | Export request |

---

## 6. ACCEPTANCE CRITERIA

### 6.1 Admin Module Criteria
| ID | Criterion | Verify Method |
|----|-----------|---------------|
| AC-AD-1 | Admin có thể create/read/update/delete user | Manual test |
| AC-AD-2 | Admin có thể gán permissions cho role | Manual test |
| AC-AD-3 | User login/logout hoạt động | Manual test |
| AC-AD-4 | Data được filter theo ChannelId | Manual test |
| AC-AD-5 | Action logs được ghi | Manual test |

### 6.2 SoHoa Module Criteria
| ID | Criterion | Verify Method |
|----|-----------|---------------|
| AC-SH-1 | User có thể upload document mới | Manual test |
| AC-SH-2 | Document đi qua đúng workflow | Manual test |
| AC-SH-3 | Mỗi check step validate đúng step | Manual test |
| AC-SH-4 | Export request tạo job thành công | Manual test |
| AC-SH-5 | Sync upload xử lý đúng folder | Manual test |

### 6.3 Integration Criteria
| ID | Criterion | Verify Method |
|----|-----------|---------------|
| AC-UN-1 | Admin và SoHoa share authentication | Cross-module test |
| AC-UN-2 | User trong SoHoa được link với user trong Admin | Database check |
| AC-UN-3 | Permissions apply trên cả hai modules | Manual test |
| AC-UN-4 | Logs track across modules | Manual test |

### 6.4 Security Criteria
| ID | Criterion | Verify Method |
|----|-----------|---------------|
| AC-SEC-1 | Passwords được hash với BCrypt | Database check |
| AC-SEC-2 | SQL injection impossible | Penetration test |
| AC-SEC-3 | XSS prevention works | Manual test |
| AC-SEC-4 | Authorization required on all actions | Manual test |

---

## 7. GAP ANALYSIS & IMPLEMENTATION TASKS

### 7.1 Critical Gaps (Must Fix)

| Gap | Severity | Task |
|-----|----------|------|
| PlaintextPasswordHasher used | 🔴 CRITICAL | Migrate to BCrypt |
| ConfigVersionController stub | 🟡 MEDIUM | Implement hoặc remove |
| Position service missing | 🟡 MEDIUM | Create service |
| Team service missing | 🟡 MEDIUM | Create service |
| Notification module missing | 🟡 MEDIUM | Create module mới |

### 7.2 Integration Issues

| Issue | Severity | Task |
|-------|----------|------|
| Role/Permission not fully integrated | 🟡 MEDIUM | Complete integration |
| Search integration limited | 🟡 MEDIUM | Improve search |
| User-Dept mapping simple | 🔵 MINOR | Enhance mapping |

### 7.3 Architecture Improvements

| Improvement | Priority | Task |
|------------|----------|------|
| ServiceResult<T> consistency | 🔵 MINOR | Ensure all services use |
| DI registration completeness | 🔵 MINOR | Verify all registered |

---

## 8. IMPLEMENTATION SEQUENCE

```
Phase 1: Tech Lead → PRD (DONE)
Phase 2: Solution Architect → Tech Design
Phase 3: Backend Dev → Implement/Fix Backend
Phase 4: Frontend Dev → Implement/Fix Views
Phase 5: Code Reviewer → Review Code
Phase 6: Security Reviewer → Review Security
Phase 7: QA Analyst → Test All
Phase 8: Doc Writer → Complete Docs
```

---

## 9. TIMELINE ESTIMATE

- **Analysis:** 1 day
- **Design:** 2 days
- **Backend Implementation:** 5-7 days
- **Frontend Implementation:** 3-5 days
- **Review & Fix:** 3-5 days
- **Total:** 15-23 days

---

## 10. RISKS & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Existing bugs phát hiện khi test | High | High | Increase test cycle |
| Integration issues | Medium | High | Thorough integration testing |
| Security concerns (password) | High | Critical | BCrypt migration priority |

---

**APPROVAL:**
- Tech Lead: ✅ 2026-04-12
- Solution Architect: ⏳ Pending
- Security Review: ⏳ Pending
- QA: ⏳ Pending