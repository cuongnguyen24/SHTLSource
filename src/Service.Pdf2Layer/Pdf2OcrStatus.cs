namespace SHTL.Service.Pdf2Layer;

/// <summary>Khớp giá trị OcrStatus PDF 2 lớp trong DB SHTL (byte 10–13).</summary>
internal enum Pdf2OcrStatus : byte
{
    SearchablePdfQueued = 10,
    SearchablePdfProcessing = 11,
    SearchablePdfReady = 12,
    SearchablePdfFailed = 13
}

internal enum Pdf2DocumentStatus : byte
{
    Active = 1
}
