using System.ComponentModel.DataAnnotations;

namespace Web.Admin.Models;

public class CreateExportTypeRequest
{
    public int ChannelId { get; set; }
    
    [Required(ErrorMessage = "Tên không được để trống")]
    [StringLength(255, ErrorMessage = "Tên không được vượt quá 255 ký tự")]
    public string Name { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Mã không được để trống")]
    [StringLength(100, ErrorMessage = "Mã không được vượt quá 100 ký tự")]
    [RegularExpression(@"^[A-Z0-9_]+$", ErrorMessage = "Mã chỉ được chứa chữ in hoa, số và dấu gạch dưới")]
    public string Code { get; set; } = string.Empty;
    
    [StringLength(1000, ErrorMessage = "Mô tả không được vượt quá 1000 ký tự")]
    public string? Description { get; set; }
}

public class UpdateExportTypeRequest
{
    public int Id { get; set; }
    
    [Required(ErrorMessage = "Tên không được để trống")]
    [StringLength(255, ErrorMessage = "Tên không được vượt quá 255 ký tự")]
    public string Name { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Mã không được để trống")]
    [StringLength(100, ErrorMessage = "Mã không được vượt quá 100 ký tự")]
    [RegularExpression(@"^[A-Z0-9_]+$", ErrorMessage = "Mã chỉ được chứa chữ in hoa, số và dấu gạch dưới")]
    public string Code { get; set; } = string.Empty;
    
    [StringLength(1000, ErrorMessage = "Mô tả không được vượt quá 1000 ký tự")]
    public string? Description { get; set; }
    
    public bool IsActive { get; set; }
    public string? ExcelFileName { get; set; }
    public string? JsonConfig { get; set; }
}
