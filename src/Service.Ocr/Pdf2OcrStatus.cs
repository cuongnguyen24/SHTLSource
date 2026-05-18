namespace SHTL.Service.Ocr;

/// <summary>Khớp giá trị OcrStatus PDF 2 lớp trong DB SHTL (byte 10–13).</summary>
internal enum OcrOcrStatus : byte
{
    OcrSearchablePdfQueued = 10,
    OcrSearchablePdfProcessing = 11,
    OcrSearchablePdfReady = 12,
    OcrSearchablePdfFailed = 13
}

internal enum OcrDocumentStatus : byte
{
    Active = 1
}
