## SHTL – Tài liệu kiến trúc & cấu hình

### 1. Tổng quan solution

Solution gồm các nhóm project chính:

- **Core / Shared**
  - `Core.Domain`: Entity, enum, value object, contract (`ICurrentUser`, `IStorageService`…).
  - `Shared.Contracts`: DTO, `PaginatedResult`, `ApiResult`, DTO workflow/uploader/log/config…
  - `Core.Application`: Application services (Document, Workflow, User, Role, Dept, Config, Report, Log, Auth).
- **Infrastructure**
  - `Infrastructure.Data`: Dapper repository cho từng bounded context (Acc/Cnf/Stg/Log/Msg/Catalog), `IDbConnectionFactory`.
  - `Infrastructure.Identity`: mật khẩu lưu plain trong DB (`PlaintextPasswordHasher`), `AuthService`, `CurrentUser`.
  - `Infrastructure.Storage`: `LocalFileStorageService` lưu file lên NAS/local, trả public url.
  - `Infrastructure.Search`: Elasticsearch (NEST) cho search metadata tài liệu.
- **Web MVC**
  - `Web.SoHoa`: web nghiệp vụ số hóa (scan, extract, check, export).
  - `Web.Admin`: web quản trị hệ thống (user/role/dept/config/log).
  - `Web.Account`: web hồ sơ cá nhân / profile.
  - `Web.Dashboard`: web dashboard/báo cáo.
- **Uploader**
  - `Web.Uploader`: upload file (multipart), lưu file, trả metadata; **API** `POST /api/upload/callback` tạo `Document` sau upload (thay cho Api.Gateway cũ).
- **Service**
  - `Service.Export`: worker xử lý hàng đợi export (CSV tối thiểu). Tham khảo mở rộng Excel: `E:\SourceCodeAXE\AXE-ServiceExport` (xem `src/Service.Export/README.md`).
- **Database scripts**
  - Folder `db/`: `core_acc.sql`, `core_cnf.sql`, `core_stg.sql`, `core_log.sql`, `core_msg.sql`, `core_catalog.sql` (không FK).

### 2. Cấu hình database & hạ tầng

#### 2.1. ConnectionStrings dùng chung

- **Một file gốc** cho cả solution: `src/Web.Dashboard/config/connectionstrings.json` (mẫu: `connectionstrings.example.json`, xem `README.md` cùng thư mục).
- Trong file có **nhiều khóa** (`CoreAcc`, `CoreCnf`, `CoreStg`, …) — mỗi bounded context có thể trỏ tới database riêng; `Infrastructure.Data` bind toàn bộ section `ConnectionStrings`.
- `src/Directory.Build.props` **copy** file gốc vào `config\connectionstrings.json` cạnh `.dll` của **mọi** project (Api, Admin, Worker, …) khi build/publish — không cần nhân bản thủ công.

```json
{
  "ConnectionStrings": {
    "CoreAcc": "Server=localhost\\\\INSTANCE;Database=Core_Acc;User Id=sa;Password=***;TrustServerCertificate=True;Encrypt=True;",
    "CoreCnf": "...",
    "CoreStg": "..."
  }
}
```

- Tất cả web/worker dùng DB đều load file đã copy trong `Program.cs`:

```csharp
builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "config", "connectionstrings.json"),
                 optional: false, reloadOnChange: true);
```

- Đổi server / mật khẩu: sửa **một lần** tại `Web.Dashboard/config/connectionstrings.json`.

#### 2.2. Cấu hình từng ứng dụng (appsettings.json)

Các `appsettings.json` trong từng project **không còn chứa `ConnectionStrings`**, mà chỉ chứa:

- `Storage`: root/virtual/thumbnail, kích thước file tối đa.
- `Elasticsearch`: `Uri`, `IndexPrefix` (Web.SoHoa, Web.Account, Web.Dashboard).
- `Uploader` / `Service.Export`: cấu hình riêng cho module.
- `Logging`, `AllowedHosts`.

Ví dụ `Web.SoHoa/appsettings.json`:

```json
{
  "Storage": {
    "RootPath": "E:\\SHTL\\Files",
    "VirtualPath": "/files",
    "ThumbnailPath": "E:\\SHTL\\Thumbs",
    "MaxFileSizeBytes": 104857600
  },
  "Elasticsearch": {
    "Uri": "http://localhost:9200",
    "IndexPrefix": "shtl"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "PluginLocalPort": 81
}
```

### 3. Chức năng từng phần

#### 3.1. Web.SoHoa

- **Mục đích**: Toàn bộ workflow số hóa:
  - Scan/Upload → Check Scan 1/2 → Zoning → OCR (tùy chọn) → Nhập liệu → Check 1/2/Final/Logic → Export.
- **Chính**:
  - `ScanController`: danh sách tài liệu scan, xem chi tiết, xóa tài liệu còn ở bước Scan.
  - `ExtractController`: form nhập liệu (`Views/Extract/Form.cshtml`) hiển thị file (PDF/ảnh) + form metadata + form cells (`FormCell`).
  - `CheckController`: các bước kiểm tra nhiều vòng.
  - `ExportController`: tạo export job (push vào `core_stg.export_jobs`).
  - Tích hợp `DocumentService`, `DocumentWorkflowService`, `ReportService`.
- **Auth**: Cookie + session, `CurrentUser` từ claims; áp dụng `AuthorizeModule`/`AuthorizeAdmin` khi cần.

#### 3.2. Web.Admin

- **Mục đích**: Quản trị hệ thống & cấu hình:
  - User, role, dept, permission/module, system config, content/record/sync/export type, log.
- **Chính**:
  - `UserController`: danh sách user, tạo user, kích hoạt/vô hiệu.
  - `RoleController`: CRUD role, lưu permissions.
  - `DeptController`: CRUD phòng ban.
  - `ConfigController`: system config, content type, record type, sync type, export type.
  - `LogController`: xem action log / access log.
- **Auth**: `BaseAdminController` kiểm tra `ICurrentUser.IsAdmin` trước khi xử lý.

#### 3.3. Web.Account

- **Mục đích**: Hồ sơ cá nhân.
- **Chính**:
  - `AccountController`: login/logout (cookie).
  - `ProfileController`: hiển thị `ProfileVm` (UserId, ChannelId, FullName, Roles, IsAdmin).

#### 3.4. Web.Dashboard

- **Mục đích**: Dashboard / báo cáo cho nghiệp vụ.
- **Chính (mẫu)**:
  - Gọi `ReportService.GetWorkflowProgressAsync` để hiển thị tổng quan số liệu theo step.
  - Có thể mở rộng báo cáo năng suất user, chất lượng OCR, v.v.

#### 3.5. Web.Uploader

- **Mục đích**: Upload file thường từ browser hoặc plugin.
- **Cấu hình**:

```json
"Storage": { ... },
"Uploader": {
  "ApiKey": "change_me",
  "AllowAnonymousUpload": true
}
```

- **API**:
  - `POST /api/upload/file?ChannelId=&FolderId=&DocTypeId=&CreatedBy=&SyncType=`
    - Multipart `file`.
    - Header `X-Api-Key` nếu `AllowAnonymousUpload = false`.
    - Trả `UploadFileResponse` (Success, FileName, StoredPath, FileSize, Extension, PublicUrl).
  - `POST /api/upload/callback` — body `UploadCallbackRequest`, header `X-Api-Key` = `Uploader:ApiKey`; gọi `DocumentService.CreateFromUploadAsync` (thay endpoint Gateway cũ).

#### 3.6. Service.Export

- **Mục đích**: Xử lý hàng đợi `export_jobs`, xuất CSV demo lên storage.
- **Cấu hình**: giống `Worker.Export` trước đây (`Worker` + `Storage` trong `appsettings.json`).
- **Mở rộng**: tham chiếu logic export Excel / factory theo kênh tại `E:\SourceCodeAXE\AXE-ServiceExport`.

### 4. Database scripts

- Folder `db/`:
  - `core_acc.sql`: schema `core_acc` – users, roles, depts, teams, role_permissions, user_roles, user_sessions.
  - `core_cnf.sql`: schema `core_cnf` – channels, configs, content_types, record_types, sync_types, export_types, translations.
  - `core_stg.sql`: schema `core_stg` – document_folders, documents (workflow flags, 20 field mở rộng), form_cells, ocr_jobs, export_jobs.
  - `core_log.sql`: schema `core_log` – access_logs, action_logs, error_logs.
  - `core_msg.sql`: schema `core_msg` – notifications.
  - `core_catalog.sql`: schema `core_catalog` – provinces, districts, wards (stub).
  - `README.md`: hướng dẫn tạo DB & chạy script.

### 5. Luồng end-to-end (tóm tắt)

1. **Upload**:
   - Client gọi `Web.Uploader` (`/api/upload/file`).
   - Service lưu file vào NAS, trả `StoredPath`, `PublicUrl`.
2. **Callback**:
   - Client gọi `Web.Uploader` `POST /api/upload/callback` (header `X-Api-Key` = `Uploader:ApiKey`).
   - `DocumentService.CreateFromUploadAsync` tạo record `core_stg.documents` (step = Scan).
3. **Nghiệp vụ số hóa**:
   - `Web.SoHoa` hiển thị tài liệu scan, cho phép nhập liệu, check, đổi workflow step.
4. **Queue nền**:
   - `Service.Export` xử lý export queue, xuất CSV demo.
5. **Quản trị & báo cáo**:
   - `Web.Admin` quản trị user/role/dept/config/log.
   - `Web.Dashboard`/`Web.SoHoa` xem dashboard/report (workflow progress, productivity).

