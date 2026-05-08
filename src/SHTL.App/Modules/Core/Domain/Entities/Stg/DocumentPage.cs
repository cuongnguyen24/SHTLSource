namespace SHTL.Modules.Core.Domain.Entities.Stg;

/// <summary>
/// Bảng Core_Stg.stg_doc_sohoa_page
/// Lưu thông tin từng trang PDF (DPI, kích thước trang).
/// Port từ AXE StgDocSoHoaPage.
/// </summary>
public class DocumentPage
{
    public long Id { get; set; }
    public long DocumentId { get; set; }
    public int PageNumber { get; set; }
    public int DpiX { get; set; }
    public int DpiY { get; set; }
    public string? PageSize { get; set; }
    public DateTime Created { get; set; } = DateTime.UtcNow;
}
