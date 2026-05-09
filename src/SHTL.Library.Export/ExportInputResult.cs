namespace SHTL.Exporting;

public class ExportInput
{
    public List<string> FieldFolders1 { get; set; } = new();
    public List<string> FieldFolders2 { get; set; } = new();
    public List<string> FieldFolders3 { get; set; } = new();
    public List<string> FieldFolders4 { get; set; } = new();
    public List<string> FieldFolders5 { get; set; } = new();
    public List<string> FieldFolders6 { get; set; } = new();
    public List<string> FieldFolders7 { get; set; } = new();
    public List<string> FieldFolders8 { get; set; } = new();
    public List<string> FieldFolders9 { get; set; } = new();
    public List<string> FieldFolders10 { get; set; } = new();

    public string? FieldFolder1_Field { get; set; }
    public string? FieldFolder2_Field { get; set; }
    public string? FieldFolder3_Field { get; set; }
    public string? FieldFolder4_Field { get; set; }
    public string? FieldFolder5_Field { get; set; }
    public string? FieldFolder6_Field { get; set; }
    public string? FieldFolder7_Field { get; set; }
    public string? FieldFolder8_Field { get; set; }
    public string? FieldFolder9_Field { get; set; }
    public string? FieldFolder10_Field { get; set; }

    public List<string> DocTypes { get; set; } = new();

    /// <summary>Override từ job JSON (vd. thuMucGoc) khi khác cấu hình file.</summary>
    public string? ThuMucGoc { get; set; }

    /// <summary>Override số cấp thư mục sau ThuMucGoc (path-based).</summary>
    public int? SoThuMuc { get; set; }
}

public class ExportResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? DownloadPath { get; set; }
    public string? DownloadLogPath { get; set; }
    public int Total { get; set; }
    public int Processed { get; set; }
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public string? Error { get; set; }
}
