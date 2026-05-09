using SHTL.Modules.Core.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace SHTL.Modules.Features.SoHoa.Models;

/// <summary>Danh mục cố định cho form tạo/sửa lượt xuất (giảm ViewBag).</summary>
public static class ExportJobFormLists
{
    public static readonly (int Value, string Text)[] DocStatuses =
    {
        (0, "Tất cả"),
        ((int)DocumentStatus.Active, "Đang hoạt động"),
        ((int)DocumentStatus.Archived, "Lưu trữ"),
        ((int)DocumentStatus.Locked, "Khóa"),
    };

    public static readonly (string Value, string Text)[] ThuMucXuat =
    {
        ("", "Mặc định (EXPORT/{JobId})"),
        ("CSDL_SOHOA_KBNN", "CSDL_SOHOA_KBNN"),
    };
}

public static class ExportJobStatusUi
{
    public static string Label(QueueStatus s) => s switch
    {
        QueueStatus.Pending => "Chờ xử lý",
        QueueStatus.Processing => "Đang xử lý",
        QueueStatus.Done => "Đã xử lý",
        QueueStatus.Error => "Lỗi",
        QueueStatus.Cancelled => "Đã hủy",
        _ => s.ToString()
    };

    public static string BadgeClass(QueueStatus s) => s switch
    {
        QueueStatus.Pending => "badge-secondary",
        QueueStatus.Processing => "badge-warning",
        QueueStatus.Done => "badge-success",
        QueueStatus.Error => "badge-danger",
        QueueStatus.Cancelled => "badge-dark",
        _ => "badge-light"
    };
}

public class CreateExportJobForm
{
    [Required(ErrorMessage = "Nhập tên lượt xuất")]
    [Display(Name = "Tên")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Chọn loại xuất")]
    [Range(1, int.MaxValue, ErrorMessage = "Chọn loại xuất")]
    [Display(Name = "Loại xuất")]
    public int ExportTypeId { get; set; }

    [Display(Name = "Trạng thái phiếu")]
    public int DocStatus { get; set; }

    [Display(Name = "Loại tài liệu")]
    public int? DocTypeId { get; set; }

    [Display(Name = "Xuất file vật lý")]
    public bool IsExportFile { get; set; } = true;

    [Display(Name = "Loại đồng bộ")]
    public int? SyncTypeId { get; set; }

    [Display(Name = "Thư mục xuất")]
    public string? ThuMucXuat { get; set; }

    /// <summary>Giá trị từng cấp thư mục (FieldFolder1_Field …), thứ tự theo cấu hình sync.</summary>
    public List<string> FolderFields { get; set; } = new();
}

public class EditExportJobForm : CreateExportJobForm
{
    public long Id { get; set; }
}
