namespace Core.Domain.Entities.Stg;

/// <summary>
/// Bảng: Core_Stg.export_types
/// Lưu cấu hình loại xuất dữ liệu (tương đương StgDocSoHoaExportType của AXE)
/// </summary>
public class ExportType : TenantEntity
{
    public int Id { get; set; }

    /// <summary>Tên loại xuất (hiển thị cho user)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Mã loại xuất (unique trong channel)</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Mô tả</summary>
    public string? Description { get; set; }

    /// <summary>Đường dẫn file Excel cấu hình gốc (nếu có)</summary>
    public string? ExcelFilePath { get; set; }

    /// <summary>Tên file Excel gốc</summary>
    public string? ExcelFileName { get; set; }

    /// <summary>Cấu hình JSON (converted từ Excel hoặc nhập trực tiếp)</summary>
    public string? JsonConfig { get; set; }

    /// <summary>Metadata để search</summary>
    public string? SearchMeta { get; set; }

    /// <summary>Trạng thái: true = active, false = disabled</summary>
    public bool IsActive { get; set; } = true;
}
