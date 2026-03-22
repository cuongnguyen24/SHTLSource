namespace Web.Shared;

/// <summary>Dùng cho breadcrumb trên partial _ShtlPageHeader.</summary>
public class BreadcrumbItem
{
    public string Text { get; set; } = "";
    public string? Url { get; set; }
}
