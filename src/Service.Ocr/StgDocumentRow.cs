namespace SHTL.Service.Ocr;

internal sealed class StgDocumentRow
{
    public long Id { get; set; }
    public int DocTypeId { get; set; }

    /// <summary>Maps cột <c>ocr_status</c>.</summary>
    public byte OcrStatus { get; set; }
    public string? Extension { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
}
