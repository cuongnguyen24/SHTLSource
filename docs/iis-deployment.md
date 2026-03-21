# Triển khai ASP.NET Core 8 lên IIS (Windows Server)

Tài liệu này mô tả cách **cài đặt môi trường** và **publish** một web app (ví dụ `Web.Admin`, `Web.Dashboard`). Lặp lại cho từng site con nếu bạn tách nhiều application dưới một site IIS.

## 1. Phần mềm cần có trên server

1. **IIS** (Turn Windows features on or off → Internet Information Services):
   - Web Management Tools
   - World Wide Web Services → Application Development Features → **ASP.NET 4.8** (tuỳ chọn, hữu ích cho công cụ)
   - **WebSocket Protocol** (nếu app dùng SignalR/WebSocket)

2. **ASP.NET Core Hosting Bundle** (đúng major **8.x** với `net8.0`):
   - Tải từ [.NET download](https://dotnet.microsoft.com/download/dotnet/8.0) → **Hosting Bundle** (gồm runtime + ASP.NET Core Module cho IIS).
   - Cài xong **khởi động lại** IIS (hoặc reboot):  
     `iisreset` (CMD/PowerShell **Run as Administrator**).

3. **SQL Server** (Express/Standard) nếu chạy DB trên cùng máy — đã có script trong `db/sqlserver/`.

## 2. Chuẩn bị ứng dụng

1. Trên máy build, từ thư mục solution:

   ```powershell
   dotnet publish .\src\Web.Admin\Web.Admin.csproj -c Release -o .\publish\Web.Admin
   ```

2. Copy thư mục `publish\Web.Admin` lên server (ví dụ `D:\Sites\SHTL\Admin`).

3. Bản gốc connection string nằm **`src\Web.Dashboard\config\connectionstrings.json`**; build đã copy vào `config\` cạnh `.dll` (`src/Directory.Build.props`). Trên IIS, đảm bảo thư mục publish có `config\connectionstrings.json`, hoặc dùng biến môi trường `ConnectionStrings__CoreAcc`, `ConnectionStrings__CoreCnf`, … (khuyến nghị production).

4. Cập nhật **`Storage:RootPath`** trong `appsettings.Production.json` (hoặc biến môi trường) trỏ tới thư mục file thật trên server, ví dụ `D:\SHTL\Files`, và cấp quyền ghi cho identity của app pool.

## 3. Tạo Application Pool

1. IIS Manager → **Application Pools** → Add:
   - **.NET CLR version**: **No Managed Code** (ASP.NET Core chạy ngoài CLR cũ).
   - **Managed pipeline**: Integrated.

2. (Tuỳ chọn) **Identity**: ApplicationPoolIdentity hoặc domain user nếu cần truy cập UNC/SQL Windows auth.

### Quan trọng: một pool cho một app ASP.NET Core

**ASP.NET Core không hỗ trợ nhiều ứng dụng trong cùng một Application Pool.** Nếu site gốc và các Application con (`/admin`, `/sohoa`, …) đều dùng **một** pool, IIS trả lỗi **HTTP 500.35** (*ASP.NET Core does not support multiple apps in the same app pool*).

Cách đúng: **mỗi** website hoặc **mỗi** Application con (virtual application) gán **một Application Pool riêng** (tên khác nhau, ví dụ `SHTL_DashPool`, `SHTL_AdminPool`, `SHTL_SoHoaPool`, …). Xem [ASP.NET Core Module](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/in-process-hosting).

## 4. Tạo Site hoặc Application

### Cách A — Site riêng cho từng project

Mỗi web một **Website** (hoặc một hostname/port khác nhau). Phù hợp khi tách domain (`admin.company.com`, `dash.company.com`).

1. Sites → Add Website → Physical path = thư mục publish của project đó.
2. Gán Application Pool (**No Managed Code**).

### Cách B — Một site: **Dashboard là web gốc**, Admin / SoHoa / Uploader / Account là **Application con**

Đây là mô hình **một hostname** (ví dụ `https://shtl.company.com/`), gốc site là Dash, các module là path con.

**Bước 1 — Publish mỗi project ra thư mục riêng trên server**, ví dụ:

| Project | Thư mục vật lý (ví dụ) |
|---------|-------------------------|
| `Web.Dashboard` | `D:\Sites\SHTL\Dash` |
| `Web.Admin` | `D:\Sites\SHTL\Admin` |
| `Web.SoHoa` | `D:\Sites\SHTL\SoHoa` |
| `Web.Uploader` | `D:\Sites\SHTL\Uploader` |
| `Web.Account` | `D:\Sites\SHTL\Account` |

**Bước 2 — Tạo một Website**

- **Physical path** trỏ tới thư mục **Dashboard** (`...\Dash`) — đây là nội dung khi truy cập `/`.
- Binding: hostname + port (ví dụ `https://shtl.company.com`).
- App pool cho site (ví dụ `SHTL_DashPool`).

**Bước 3 — Add Application** (chuột phải site → **Add Application**)

| Alias (URL path) | Physical path | Ghi chú |
|------------------|---------------|---------|
| `admin` | `...\Admin` | → `https://host/admin` |
| `sohoa` | `...\SoHoa` | → `https://host/sohoa` |
| `uploader` | `...\Uploader` | → `https://host/uploader` |
| `account` | `...\Account` | → `https://host/account` |

Trên **Dashboard**, các link module đọc từ `appsettings.json` → mục **`Dashboard`** (`AdminUrl`, `SoHoaUrl`, …). Mặc định đã dùng path trên (`/admin`, `/sohoa`, `/uploader`, `/account`); nếu bạn đổi alias IIS hoặc dùng subdomain, chỉnh lại các giá trị này (hoặc biến môi trường tương ứng).

**Đăng nhập Dashboard** không nằm trong `Web.Dashboard` — trình duyệt được chuyển tới **`Web.Account`** (`Authentication:ExternalLoginUrl`, mặc định `/account/Account/Login` khi cùng site). **Đăng xuất** dùng `Authentication:ExternalLogoutUrl` (mặc định `/account/Account/Logout`). Khi dev chạy `dotnet run` hai cổng khác nhau, đặt URL đầy đủ trong `appsettings.Development.json` của Dashboard và thêm tiền tố URL Dashboard vào **`Authentication:AllowedReturnUrlPrefixes`** của `Web.Account` (để sau đăng nhập redirect an toàn).

**Trang lỗi tuỳ chỉnh (404/500):** `ErrorHandling:UseCustomErrorPages` trong `Web.Dashboard` và `Web.Account` — `true` dùng view `NotFound` / `ServerError`; `false` thì Development hiện chi tiết exception, 404 dùng hành vi mặc định.

**Bắt buộc:** Gán **Application Pool khác nhau** cho site gốc (Dashboard) và cho **từng** Application con — không dùng chung một pool (sẽ gây **500.35**). Ví dụ: `SHTL_DashPool` → site; `SHTL_AdminPool` → app `admin`; `SHTL_SoHoaPool` → app `sohoa`; …

**Bước 4 — Bắt buộc: `ASPNETCORE_PATHBASE` cho từng Application con**

ASP.NET Core phải biết nó đang chạy dưới prefix `/admin`, `/sohoa`, …

- Với **site gốc (Dashboard)** ở `/`: thường **không** cần `ASPNETCORE_PATHBASE` (để trống).
- Với **mỗi Application con**, trong IIS → Application đó → **Configuration Editor** hoặc **Environment Variables** (tuỳ bản IIS), hoặc **Application Settings** nếu dùng công cụ hỗ trợ:

  - Tên: `ASPNETCORE_PATHBASE`
  - Giá trị: **đúng** alias có dấu `/` đầu, ví dụ `/admin`, `/sohoa`, `/uploader`, `/account`

*(Trên IIS 10 có thể thêm biến môi trường cho từng application qua `web.config` của app con hoặc UI “Environment variables” của ASP.NET Core Module tùy phiên bản — nếu không thấy, có thể đặt trong `web.config` publish: `<environmentVariable name="ASPNETCORE_PATHBASE" value="/admin" />` trong phần `aspNetCore`.)*

**Bước 5 — Link giữa các module**

- Trong view/layout, link sang Admin dùng đường dẫn **tuyệt đối từ gốc site**: `href="/admin"`, `href="/sohoa"`, … (không dùng `~/` chéo application khác như một site duy nhất).

**Cookie / đăng nhập**

- Mỗi application là process riêng; cookie mặc định **không** chia sẻ giữa `/admin` và `/sohoa` trừ khi bạn cấu hình cùng domain + cookie path/domain — thường chấp nhận **đăng nhập riêng** từng app hoặc sau này dùng SSO/token.

### Cách C — Chỉ một vài app làm Application con (giống B nhưng ít alias)

Giống **Cách B**, chỉ Add Application cho những project thật sự triển khai.

## 5. Kiểm tra `web.config`

`dotnet publish` sinh `web.config` với **ASP.NET Core Module** (`aspNetCore` → `dotnet Web.Admin.dll`). Không chỉnh tay trừ khi cần:

- `stdoutLogEnabled="true"` tạm thời để xem lỗi khởi động.
- Đường dẫn `dotnet` nếu server không có trong PATH (hiếm khi cần).

## 6. HTTPS (khuyến nghị)

- Binding → Add → https, chọn certificate (Let's Encrypt / internal PKI).
- Trong ASP.NET Core, `UseHttpsRedirection()` sẽ redirect HTTP → HTTPS khi có binding https.

## 7. Service.Export

Không host trong IIS; chạy **Windows Service**, **Task Scheduler**, hoặc `dotnet Service.Export.dll` với `appsettings.json` + `config/connectionstrings.json` (copy như các web).

## 8. Gỡ lỗi nhanh

- **500.35 — *multiple apps in the same app pool***: Tạo thêm Application Pool (No Managed Code), gán **một pool riêng** cho từng Application/site đang chạy ASP.NET Core (xem mục 3). Không gom nhiều app con vào cùng pool với site cha hoặc với nhau.
- **502.5 / 500.30**: thường là app không start — bật stdout log, xem Event Viewer → Windows Logs → Application (entries từ IIS AspNetCore Module).
- **Không tìm thấy connection string**: kiểm tra `config\connectionstrings.json` cạnh `.dll` hoặc biến môi trường `ConnectionStrings__CoreAcc`, …
- **403**: quyền NTFS trên thư mục site cho identity app pool.
