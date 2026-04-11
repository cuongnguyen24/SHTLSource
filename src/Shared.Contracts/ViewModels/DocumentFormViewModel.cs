using Shared.Contracts.Dtos;

namespace Shared.Contracts.ViewModels;

/// <summary>
/// ViewModel cho form nhập/sửa tài liệu với cấu hình động
/// </summary>
public class DocumentFormViewModel
{
    /// <summary>Document hiện tại (null nếu tạo mới)</summary>
    public DocumentDto? Document { get; set; }
    
    /// <summary>Thông tin DocType</summary>
    public DocTypeFullDto DocType { get; set; } = null!;
    
    /// <summary>Cấu hình trường động (đã sort theo weight)</summary>
    public IReadOnlyList<FieldSettingViewModel> FieldSettings { get; set; } = Array.Empty<FieldSettingViewModel>();
    
    /// <summary>Nhóm trường (để render theo section)</summary>
    public IReadOnlyDictionary<int, FieldGroupViewModel> FieldGroups { get; set; } = new Dictionary<int, FieldGroupViewModel>();
    
    /// <summary>Metadata bổ sung</summary>
    public IReadOnlyList<CategoryTypeDto> CategoryTypes { get; set; } = Array.Empty<CategoryTypeDto>();
    public IReadOnlyList<PatternTypeDto> PatternTypes { get; set; } = Array.Empty<PatternTypeDto>();
    
    /// <summary>Giá trị hiện tại của các trường động (key = field name)</summary>
    public Dictionary<string, string?> FieldValues { get; set; } = new();
    
    /// <summary>Form cells (OCR data)</summary>
    public IEnumerable<Core.Domain.Entities.Stg.FormCell> Cells { get; set; } = Enumerable.Empty<Core.Domain.Entities.Stg.FormCell>();
    
    /// <summary>User names map</summary>
    public IDictionary<int, string> UserNames { get; set; } = new Dictionary<int, string>();
}

/// <summary>
/// Cấu hình 1 trường trong form
/// </summary>
public class FieldSettingViewModel
{
    public int Id { get; set; }                      // stg_doc_field_settings.id
    public int FieldId { get; set; }                 // stg_doc_fields.id
    public string FieldName { get; set; } = string.Empty;  // stg_doc_fields.name (dc_title, fc_start...)
    public string Title { get; set; } = string.Empty;      // Nhãn hiển thị
    public string InputType { get; set; } = "text";        // text, number, date, select, textarea
    public string Datatype { get; set; } = string.Empty;   // dctext, fcnumber, datetime...
    public int Row { get; set; }                     // Số dòng (textarea)
    public int Col { get; set; }                     // Cột layout
    public int Weight { get; set; }                  // Thứ tự
    public int GroupId { get; set; }                 // Nhóm
    
    // Validation
    public bool IsRequired { get; set; }
    public int MinLen { get; set; }
    public int MaxLen { get; set; }
    public string? MinValue { get; set; }
    public string? MaxValue { get; set; }
    public string? PatternCustom { get; set; }
    public int PatternTypeId { get; set; }
    
    // Behavior
    public bool IsReadOnly { get; set; }
    public bool IsUpperCase { get; set; }
    public bool IsCapitalize { get; set; }
    public bool IsMulti { get; set; }
    public string? FixValue { get; set; }
    public string? Format { get; set; }
    
    // Catalog
    public bool IsCatalog { get; set; }
    public bool IsCatalogMain { get; set; }
    public int CategoryTypeId { get; set; }
    
    // CSS
    public string? CssClass { get; set; }
}

/// <summary>
/// Nhóm trường
/// </summary>
public class FieldGroupViewModel
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? GroupName { get; set; }
    public int Weight { get; set; }
    public int ParentId { get; set; }
}
