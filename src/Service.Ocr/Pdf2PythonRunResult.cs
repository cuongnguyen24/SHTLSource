namespace SHTL.Service.Ocr;

/// <summary>Kết quả chạy script Python tạo PDF 2 lớp (để ghi log lỗi rõ ràng).</summary>
internal readonly record struct OcrPythonRunResult(bool Ok, string Reason, int? ExitCode = null)
{
    public static OcrPythonRunResult Success() => new(true, string.Empty, 0);

    public static OcrPythonRunResult Fail(string reason, int? exitCode = null) =>
        new(false, reason, exitCode);
}
