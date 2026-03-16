using Core.Domain.Enums;

namespace Core.Domain.Entities.Stg;

/// <summary>
/// Bảng: Core_Stg.form_cells
/// Lưu từng ô trên biểu mẫu OCR: tọa độ, giá trị raw, giá trị sau nhập liệu, kết quả kiểm tra.
/// </summary>
public class FormCell : BaseEntity
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long DocumentId { get; set; }
    public int Cell { get; set; }
    public FormCellType CellType { get; set; }
    public string? GroupCell { get; set; }
    public string? Field { get; set; }
    public string? Title { get; set; }

    // Tọa độ trên trang
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Page { get; set; }
    public int PageWidth { get; set; }
    public int PageHeight { get; set; }
    public string? CroppedPath { get; set; }

    // Giá trị OCR
    public string? Value { get; set; }

    // Nhập liệu
    public string? ExtractedValue { get; set; }
    public DateTime? ExtractedAt { get; set; }
    public int ExtractedBy { get; set; }
    public StepResult ExtractedResult { get; set; }

    // Kiểm tra lần 1
    public string? Checked1Value { get; set; }
    public DateTime? Checked1At { get; set; }
    public int Checked1By { get; set; }
    public StepResult Checked1Result { get; set; }
    public bool IsValueDiff1 { get; set; }

    // Kiểm tra lần 2
    public string? Checked2Value { get; set; }
    public DateTime? Checked2At { get; set; }
    public int Checked2By { get; set; }
    public StepResult Checked2Result { get; set; }
    public bool IsValueDiff2 { get; set; }

    // Địa chỉ hành chính
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Ward { get; set; }
}

/// <summary>Bảng: Core_Stg.workflow_step_statuses - log từng bước workflow</summary>
public class WorkflowStepStatus
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public long DocumentId { get; set; }
    public WorkflowStep Step { get; set; }
    public StepResult Result { get; set; }
    public int ProcessedBy { get; set; }
    public DateTime ProcessedAt { get; set; }
    public string? Note { get; set; }
}
