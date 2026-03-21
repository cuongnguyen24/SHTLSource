namespace Web.Dashboard.Models;

public class ErrorHandlingOptions
{
    public const string SectionName = "ErrorHandling";

    /// <summary>
    /// true: trang NotFound / ServerError tự viết + xử lý mã lỗi HTTP.
    /// false: hành vi mặc định (Development: chi tiết exception; 404: trang trống mặc định).
    /// </summary>
    public bool UseCustomErrorPages { get; set; }
}
