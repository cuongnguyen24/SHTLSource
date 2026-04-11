using Core.Domain.Entities.Stg;

namespace Core.Application.Services.Axe;

/// <summary>
/// Helper để map giữa StgDocField names và Document entity properties
/// </summary>
public static class StgFieldToDocumentMapper
{
    /// <summary>
    /// Extract giá trị từ Document entity thành dictionary theo field name
    /// </summary>
    public static Dictionary<string, string?> ExtractValues(Document doc)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        
        // Core fields
        values["dc_title"] = doc.Name;
        values["dc_symbol"] = doc.SymbolNo;
        values["dc_record"] = doc.RecordNo;
        values["dc_issued_by"] = doc.IssuedBy;
        values["dc_author"] = doc.Author;
        values["dc_issued"] = doc.Issued?.ToString("yyyy-MM-dd");
        values["dc_issued_year"] = doc.IssuedYear?.ToString();
        values["dc_noted"] = doc.Noted;
        
        // Extended fields (Field1-8)
        values["field1"] = doc.Field1;
        values["field2"] = doc.Field2;
        values["field3"] = doc.Field3;
        values["field4"] = doc.Field4;
        values["field5"] = doc.Field5;
        values["field6"] = doc.Field6;
        values["field7"] = doc.Field7;
        values["field8"] = doc.Field8;
        
        return values;
    }
    
    /// <summary>
    /// Apply giá trị từ form vào Document entity dựa trên field name
    /// </summary>
    public static void ApplyValue(Document doc, string fieldName, string? value)
    {
        switch (fieldName.ToLowerInvariant())
        {
            case "dc_title":
                doc.Name = value ?? "";
                break;
            case "dc_symbol":
                doc.SymbolNo = value;
                break;
            case "dc_record":
                doc.RecordNo = value;
                break;
            case "dc_issued_by":
                doc.IssuedBy = value;
                break;
            case "dc_author":
                doc.Author = value;
                break;
            case "dc_issued":
                if (DateTime.TryParse(value, out var issued))
                    doc.Issued = issued;
                break;
            case "dc_issued_year":
                if (int.TryParse(value, out var year))
                    doc.IssuedYear = year;
                break;
            case "dc_noted":
                doc.Noted = value;
                break;
            case "field1":
                doc.Field1 = value;
                break;
            case "field2":
                doc.Field2 = value;
                break;
            case "field3":
                doc.Field3 = value;
                break;
            case "field4":
                doc.Field4 = value;
                break;
            case "field5":
                doc.Field5 = value;
                break;
            case "field6":
                doc.Field6 = value;
                break;
            case "field7":
                doc.Field7 = value;
                break;
            case "field8":
                doc.Field8 = value;
                break;
        }
    }
    
    /// <summary>
    /// Parse form collection và apply vào Document
    /// </summary>
    public static void ApplyFormValues(Document doc, Microsoft.AspNetCore.Http.IFormCollection form)
    {
        foreach (var key in form.Keys.Where(k => k.StartsWith("field_", StringComparison.OrdinalIgnoreCase)))
        {
            var fieldName = key.Substring(6); // Remove "field_" prefix
            var value = form[key].ToString();
            ApplyValue(doc, fieldName, value);
        }
    }
    
    /// <summary>
    /// Get field name mapping cho các trường cố định (backward compatibility)
    /// </summary>
    public static string? GetFieldNameForLegacyField(string legacyFieldName)
    {
        return legacyFieldName.ToLowerInvariant() switch
        {
            "name" => "dc_title",
            "symbolno" => "dc_symbol",
            "recordno" => "dc_record",
            "issuedby" => "dc_issued_by",
            "author" => "dc_author",
            "issued" => "dc_issued",
            "issuedyear" => "dc_issued_year",
            "noted" => "dc_noted",
            _ => null
        };
    }
}
