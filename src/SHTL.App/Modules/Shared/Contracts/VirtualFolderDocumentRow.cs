namespace SHTL.Modules.Shared.Contracts;

/// <summary>Bản ghi tối thiểu để xóa file + soft-delete theo “thư mục ảo” (báo cáo tiến độ).</summary>
public sealed class VirtualFolderDocumentRow
{
    public long Id { get; set; }
    public string? FilePath { get; set; }
    public string? ThumbPath { get; set; }
    public string? PathPdfSearchable { get; set; }
    public string? PathConverted { get; set; }
    public string? PathOriginal { get; set; }
}
