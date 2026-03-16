## SHTL – Tài liệu kiến trúc & cấu hình

### 1. Tổng quan solution

Solution gồm các nhóm project chính:

- **Core / Shared**
  - `Core.Domain`: Entity, enum, value object, contract (`ICurrentUser`, `IStorageService`…).
  - `Shared.Contracts`: DTO, `PaginatedResult`, `ApiResult`, DTO workflow/uploader/log/config…
  - `Core.Application`: Application services (Document, Workflow, User, Role, Dept, Config, Report, Log, Auth).
- **Infrastructure**
  - `Infrastructure.Data`: Dapper repository cho từng bounded context (Acc/Cnf/Stg/Log/Msg/Catalog), `IDbConnectionFactory`.
  - `Infrastructure.Identity`: password hashing (BCrypt), `AuthService`, `CurrentUser`, authorize attribute.
  - `Infrastructure.Storage`: `LocalFileStorageService` lưu file lên NAS/local, trả public url.
  - `Infrastructure.Search`: Elasticsearch (NEST) cho search metadata tài liệu.
- **Web MVC**
  - `Web.SoHoa`: web nghiệp vụ số hóa (scan, extract, check, export).
  - `Web.Admin`: web quản trị hệ thống (user/role/dept/config/log).
  - `Web.Account`: web hồ sơ cá nhân / profile.
  - `Web.Dashboard`: web dashboard/báo cáo.
- **API & Uploader**
  - `Web.Uploader`: upload file thường (multipart), lưu file, trả metadata.
  - `Web.ResumableUploader`: upload file lớn theo chunk.
  - `Api.Gateway`: Web API (callback upload để tạo Document, tích hợp ngoài).
- **Worker / Plugin**
  - `Worker.Ocr`: xử lý OCR queue (stub – đánh dấu hoàn thành).
  - `Worker.Export`: xử lý export queue, xuất CSV demo và lưu file.
  - `Plugin.Desktop`: WinForms plugin desktop, expose local HTTP endpoint `http://localhost:81/plugin` cho browser gọi, upload file + callback Gateway.
- **Database scripts**
  - Folder `db/`: `core_acc.sql`, `core_cnf.sql`, `core_stg.sql`, `core_log.sql`, `core_msg.sql`, `core_catalog.sql` (không FK).

### 2. Cấu hình database & hạ tầng

#### 2.1. ConnectionStrings dùng chung

- File **duy nhất**: `config/connectionstrings.json`

```json
{
  "ConnectionStrings": {
    "CoreAcc": "Host=localhost;Port=5432;Database=Core_Acc;Username=postgres;Password=YourPassword",
    "CoreCnf": "Host=localhost;Port=5432;Database=Core_Cnf;Username=postgres;Password=YourPassword",
    "CoreStg": "Host=localhost;Port=5432;Database=Core_Stg;Username=postgres;Password=YourPassword",
    "CoreLog": "Host=localhost;Port=5432;Database=Core_Log;Username=postgres;Password=YourPassword",
    "CoreMsg": "Host=localhost;Port=5432;Database=Core_Msg;Username=postgres;Password=YourPassword",
    "CoreCatalog": "Host=localhost;Port=5432;Database=Core_Catalog;Username=postgres;Password=YourPassword"
  }
}
```

- Tất cả web/worker dùng DB đều load file này trong `Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine("..", "config", "connectionstrings.json"),
                 optional: false, reloadOnChange: true);
```

Worker dùng `Host.CreateApplicationBuilder` thì thêm `.AddJsonFile(Path.Combine("..", "config", "connectionstrings.json"), ...)` trước `.AddEnvironmentVariables()`.

- Thay đổi server DB / password chỉ cần sửa **một lần** ở `config/connectionstrings.json`.

#### 2.2. Cấu hình từng ứng dụng (appsettings.json)

Các `appsettings.json` trong từng project **không còn chứa `ConnectionStrings`**, mà chỉ chứa:

- `Storage`: root/virtual/thumbnail, kích thước file tối đa.
- `Elasticsearch`: `Uri`, `IndexPrefix` (Web.SoHoa, Web.Account, Web.Dashboard).
- `Uploader` / `Resumable` / `Gateway` / `Worker`: cấu hình riêng cho module.
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

#### 3.6. Web.ResumableUploader

- **Mục đích**: Upload file lớn theo chunk.
- **Cấu hình**:

```json
"Storage": { ... },
"Resumable": {
  "TempPath": "E:\\SHTL\\TempUploads",
  "ApiKey": "change_me",
  "AllowAnonymousUpload": true
}
```

- **API chính**:
  - `POST /api/resumable/init` → `{ fileId }`.
  - `POST /api/resumable/chunk?channelId=&fileId=&chunkIndex=` + `chunk` file.
  - `POST /api/resumable/complete` → assemble + save storage → `StoredPath`, `PublicUrl`.

#### 3.7. Api.Gateway

- **Mục đích**: Gateway cho callback upload & tích hợp ngoài.
- **Cấu hình**:

```json
"Gateway": {
  "ApiKey": "change_me"
}
```

- **Bảo mật**: header `X-Api-Key` qua `ApiKeyAuthAttribute`.
- **API**:
  - `POST /api/upload/callback`:
    - Body: `UploadCallbackRequest`.
    - Gọi `DocumentService.CreateFromUploadAsync` để tạo `Document` trong `Core_Stg`.

#### 3.8. Worker.Ocr

- **Mục đích**: Xử lý OCR queue (hiện là stub).
- **Cấu hình**:

```json
"Worker": {
  "IntervalSeconds": 5,
  "BatchSize": 10
}
```

- **Hành vi**:
  - Hàng vòng lặp:
    - Lấy `batchSize` job Pending từ `core_stg.ocr_jobs`.
    - Set `Processing` → chờ ngắn → set `Done` với message `"Done (stub)"`.
  - Sau này có thể thay `TODO` bằng call OCR engine, lưu kết quả vào bảng OCR result.

#### 3.9. Worker.Export

- **Mục đích**: Xử lý export queue.
- **Cấu hình**:

```json
"Storage": { ... },
"Worker": {
  "IntervalSeconds": 5,
  "BatchSize": 50,
  "ExportSubPath": "exports"
}
```

- **Hành vi (demo)**:
  - Lấy các job Pending từ `core_stg.export_jobs`.
  - Set `Processing`, gọi `IDocumentRepository` để lấy docs theo channel.
  - Xuất CSV (một số trường cơ bản) vào `MemoryStream`, lưu NAS qua `IStorageService.SaveFileAsync`.
  - Cập nhật `download_path`, status `Done`, message chứa publicUrl.

#### 3.10. Plugin.Desktop (WinForms)

- **Mục đích**:
  - Chạy trên máy trạm, phục vụ:
    - Các thao tác scan (sẽ thêm sau).
    - Upload file → Web.Uploader → Api.Gateway callback.
    - Expose endpoint local để browser gọi.

- **Cấu hình** (`Plugin.Desktop/appsettings.json`):

```json
"Plugin": {
  "ListenPrefix": "http://localhost:81/plugin/",
  "UploaderUrl": "http://localhost:5005/api/upload/file",
  "GatewayCallbackUrl": "http://localhost:5006/api/upload/callback",
  "UploaderApiKey": "change_me",
  "GatewayApiKey": "change_me",
  "ChannelId": 1,
  "CreatedBy": 1,
  "DocTypeId": 1,
  "FolderId": 0,
  "SyncType": 2
}
```

- **Thành phần**:
  - `LocalPluginServer` (HttpListener):
    - `GET /plugin/ping` → kiểm tra sống/chết.
    - `POST /plugin/upload` body `{ filePath }`:
      - Gửi file tới `UploaderUrl`.
      - Gửi `UploadCallbackRequest` tới `GatewayCallbackUrl`.
  - `Form1`:
    - Nút Start local endpoint.
    - Nút chọn file & upload (gọi `/plugin/upload`).
    - Log ra TextBox.

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
   - Browser hoặc Plugin gọi `Web.Uploader` (`/api/upload/file`) hoặc `Web.ResumableUploader` (chunk).
   - Service lưu file vào NAS, trả `StoredPath`, `PublicUrl`.
2. **Callback**:
   - Plugin hoặc service gọi `Api.Gateway /api/upload/callback` (API key).
   - `DocumentService.CreateFromUploadAsync` tạo record `core_stg.documents` (step = Scan).
3. **Nghiệp vụ số hóa**:
   - `Web.SoHoa` hiển thị tài liệu scan, cho phép nhập liệu, check, đổi workflow step.
4. **Queue nền**:
   - `Worker.Ocr` xử lý OCR queue (stub).
   - `Worker.Export` xử lý export queue, xuất CSV demo.
5. **Quản trị & báo cáo**:
   - `Web.Admin` quản trị user/role/dept/config/log.
   - `Web.Dashboard`/`Web.SoHoa` xem dashboard/report (workflow progress, productivity).

