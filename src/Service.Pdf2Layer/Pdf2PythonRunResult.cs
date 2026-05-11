namespace SHTL.Service.Pdf2Layer;

/// <summary>Kết quả chạy script Python tạo PDF 2 lớp (để ghi log lỗi rõ ràng).</summary>
internal readonly record struct Pdf2PythonRunResult(bool Ok, string Reason, int? ExitCode = null)
{
    public static Pdf2PythonRunResult Success() => new(true, string.Empty, 0);

    public static Pdf2PythonRunResult Fail(string reason, int? exitCode = null) =>
        new(false, reason, exitCode);
}
