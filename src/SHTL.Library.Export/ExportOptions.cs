namespace SHTL.Exporting;

public class ExportOptions
{
    public const string SectionName = "Export";

    public string? ConfigServerPath { get; set; }
    public string? ExcelServerPath { get; set; }
    public string? DuongDanXuatFileVatLyDoiTen { get; set; }
    public string RelativeConfigSubPath { get; set; } = "Config/export";
}
