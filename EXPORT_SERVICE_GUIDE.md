# Hướng dẫn sử dụng Export Service

## 1. Cài đặt ban đầu

### 1.1. Chạy Database Migration

```bash
# Kết nối MySQL và chạy migration
mysql -u root -p Core_Stg < database/migrations/2026-04-09_create_export_types.sql
```

Migration sẽ tạo:
- Bảng `export_types` - Lưu cấu hình loại xuất
- Cập nhật bảng `export_jobs` với các field mới

### 1.2. Cấu hình appsettings.json

**Service.Export/appsettings.json:**
```json
{
  "Worker": {
    "IntervalSeconds": 5,
    "BatchSize": 5,
    "ExportSubPath": "exports"
  },
  "Storage": {
    "BasePath": "D:/Storage/SHTL"
  }
}
```

## 2. Quản lý Loại Xuất (ExportType)

### 2.1. Truy cập Admin UI

1. Đăng nhập vào Admin: `https://your-domain/admin`
2. Vào menu: **Cấu hình** → **Loại xuất dữ liệu**
3. URL: `/admin/exporttype`

### 2.2. Tạo Loại Xuất mới

**Cách 1: Nhập thủ công**

1. Click "Tạo mới"
2. Nhập thông tin:
   - **Tên**: Xuất Văn bản hành chính
   - **Mã**: VBHC (chữ in hoa, không dấu)
   - **Mô tả**: Xuất văn bản hành chính theo cấu trúc thư mục
3. Click "Lưu"

**Cách 2: Upload Excel cấu hình**

1. Click "Tạo mới"
2. Nhập Tên và Mã
3. Upload file Excel (.xlsx hoặc .xls)
4. Hệ thống tự động convert Excel → JSON
5. Click "Lưu"

### 2.3. Format File Excel Cấu hình

File Excel cần có 3 sheets:

**Sheet 1: Settings**
| Key | Value |
|-----|-------|
| ThuMucGoc | CSDL_SOHOA |
| SoThuMuc | 7 |
| DefaultIDBia | 1 |
| DefaultIDVanBan | 2 |
| UsePathBasedStructure | false |

**Sheet 2: FieldFolders**
| Level | FieldName | FolderName | MaxLength | PaddingChar |
|-------|-----------|------------|-----------|-------------|
| 1 | Field70 | Tang | 2 | 0 |
| 2 | Field71 | Ke | 2 | 0 |
| 3 | Field72 | Ngan | 2 | 0 |

**Sheet 3: DataMappings**
| SourceField | TargetColumn | DefaultValue | MappingFile | SourceColumn | TargetColumn | CaseSensitive |
|-------------|--------------|--------------|-------------|--------------|--------------|---------------|
| Name | TenTaiLieu | | | | | false |
| SymbolNo | SoKyHieu | | mapping.xlsx | Source | Target | true |

## 3. Tạo Export Job

### 3.1. Từ Code (API/Service)

```csharp
// Inject repository
private readonly IExportJobRepository _exportRepo;

// Tạo job
var job = new ExportJob
{
    ChannelId = currentUser.ChannelId,
    ExportTypeId = 1, // ID của ExportType
    Name = "Export VBHC tháng 4/2026",
    FilterJson = JsonSerializer.Serialize(new 
    {
        docTypeId = 1,
        startDate = "2026-04-01",
        endDate = "2026-04-30"
    }),
    ExportInputJson = JsonSerializer.Serialize(new
    {
        FieldFolder1_Field = "Field70",
        FieldFolder2_Field = "Field71",
        FieldFolder3_Field = "Field72"
    }),
    FieldFolderExport = 3, // Tách file Excel theo cấp 3
    DocStatus = 0, // 0 = all
    IsExportFile = true, // Export cả file
    Status = QueueStatus.Pending,
    RequestedBy = currentUser.Id
};

await _exportRepo.EnqueueAsync(job);
```

### 3.2. Từ UI (TODO - chưa implement)

Sẽ có màn hình Export trong module SoHoa để user chọn:
- Loại xuất
- Bộ lọc (ngày, loại tài liệu, phòng ban)
- Tùy chọn (có export file không, tách Excel theo cấp nào)

## 4. Worker Service xử lý

### 4.1. Cách hoạt động

1. **Service.Export** chạy như Windows Service/systemd daemon
2. Mỗi 5 giây, worker poll queue để lấy job Pending
3. Với mỗi job:
   - Load ExportType configuration từ database
   - Tạo exporter instance (dựa trên ExportType.Code)
   - Execute export logic
   - Update job status + download link

### 4.2. Chạy Service

**Development:**
```bash
cd src/Service.Export
dotnet run
```

**Production (Windows Service):**
```bash
# Publish
dotnet publish -c Release -o C:\Services\SHTL.Export

# Install service
sc create "SHTL.Export" binPath="C:\Services\SHTL.Export\Service.Export.exe"
sc start "SHTL.Export"
```

**Production (Linux systemd):**
```bash
# Publish
dotnet publish -c Release -o /opt/shtl/export

# Create systemd service
sudo nano /etc/systemd/system/shtl-export.service

# Content:
[Unit]
Description=SHTL Export Service
After=network.target

[Service]
Type=notify
WorkingDirectory=/opt/shtl/export
ExecStart=/usr/bin/dotnet /opt/shtl/export/Service.Export.dll
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable shtl-export
sudo systemctl start shtl-export
sudo systemctl status shtl-export
```

## 5. Implement Concrete Exporter

### 5.1. Tạo Exporter mới

```csharp
// File: Service.Export/Exporters/VBHCExporter.cs
using Service.Export.Exporters;

namespace Service.Export.Exporters;

public class VBHCExporter : BaseExporter
{
    public VBHCExporter(
        ILogger<VBHCExporter> logger,
        IConfiguration config,
        ExportJob queue,
        ExportType exportType)
        : base(logger, config, queue, exportType)
    {
    }

    protected override async Task<ExportResult> ExecuteExportAsync()
    {
        try
        {
            // 1. Query documents
            var docs = await GetDocumentsAsync();
            
            // 2. Create folder structure
            CreateFolderStructure();
            
            // 3. Export Excel metadata
            await ExportExcelAsync(docs);
            
            // 4. Copy files
            await CopyFilesAsync(docs);
            
            // 5. Compress to ZIP
            var zipPath = await CompressFolderAsync(TargetPath, $"export_{JobId}.zip");
            
            return new ExportResult
            {
                Success = true,
                DownloadPath = zipPath,
                Total = docs.Count,
                Processed = docs.Count,
                SuccessCount = docs.Count,
                ErrorCount = 0
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "VBHCExporter failed");
            return new ExportResult
            {
                Success = false,
                Error = ex.ToString()
            };
        }
    }
    
    private async Task<List<Document>> GetDocumentsAsync()
    {
        // TODO: Query documents based on Queue.FilterJson
        return new List<Document>();
    }
    
    private void CreateFolderStructure()
    {
        // TODO: Create folder structure based on Config.FieldFolderMappings
    }
    
    private async Task ExportExcelAsync(List<Document> docs)
    {
        // TODO: Export to Excel using ClosedXML
    }
    
    private async Task CopyFilesAsync(List<Document> docs)
    {
        // TODO: Copy files to target folders
    }
}
```

### 5.2. Register trong Worker

```csharp
// File: Service.Export/Worker.cs
private BaseExporter? CreateExporter(ExportJob job, ExportType exportType)
{
    return exportType.Code switch
    {
        "VBHC" => new VBHCExporter(_logger, _cfg, job, exportType),
        "TAILIEU" => new TAILIEUExporter(_logger, _cfg, job, exportType),
        _ => null
    };
}
```

## 6. Monitoring & Troubleshooting

### 6.1. Xem Log

**Development:**
```bash
# Console output
dotnet run
```

**Production:**
```bash
# Windows Event Viewer
eventvwr.msc → Application Logs

# Linux journalctl
sudo journalctl -u shtl-export -f
```

### 6.2. Kiểm tra Queue Status

```sql
-- Xem các job đang chạy
SELECT * FROM export_jobs 
WHERE status = 1 -- Processing
ORDER BY created_at DESC;

-- Xem các job lỗi
SELECT * FROM export_jobs 
WHERE status = 3 -- Error
ORDER BY created_at DESC
LIMIT 10;

-- Xem thống kê
SELECT 
    status,
    COUNT(*) as count,
    AVG(processed) as avg_processed
FROM export_jobs
GROUP BY status;
```

### 6.3. Retry Failed Job

```sql
-- Reset job về Pending để retry
UPDATE export_jobs 
SET status = 0, 
    message = NULL,
    processed_at = NULL
WHERE id = 123;
```

## 7. Best Practices

1. **Đặt tên ExportType.Code:**
   - Dùng chữ IN HOA
   - Không dấu, không khoảng trắng
   - Ví dụ: VBHC, TAILIEU, TOAAN

2. **File Excel cấu hình:**
   - Lưu template mẫu để tái sử dụng
   - Version control các file config
   - Test kỹ trước khi upload production

3. **Performance:**
   - Giới hạn batch size (mặc định 5 jobs/lần)
   - Tăng interval nếu server load cao
   - Monitor disk space cho exports

4. **Security:**
   - Validate file upload (chỉ .xlsx, .xls)
   - Giới hạn file size
   - Scan virus trước khi process

5. **Cleanup:**
   - Tự động xóa file export cũ (>30 ngày)
   - Archive completed jobs
   - Monitor storage usage

## 8. FAQ

**Q: Làm sao để thêm field mới vào Excel export?**
A: Cập nhật DataMappings trong file Excel config, upload lại.

**Q: Worker không chạy job?**
A: Kiểm tra:
- Service có đang chạy không?
- Job status = 0 (Pending)?
- ExportType có tồn tại không?
- Log có lỗi gì không?

**Q: Export bị lỗi "ExportType not found"?**
A: Kiểm tra ExportJob.ExportTypeId có đúng không, ExportType có bị xóa không.

**Q: Làm sao để pause worker tạm thời?**
A: Stop service, hoặc set Worker:IntervalSeconds = 999999 trong appsettings.

---

**Liên hệ hỗ trợ:** [Your contact info]
