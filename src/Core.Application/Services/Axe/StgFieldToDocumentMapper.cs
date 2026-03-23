using Core.Domain.Entities.Stg;

namespace Core.Application.Services.Axe;

/// <summary>Ánh xạ <c>stg_doc_fields.name</c> sang cột <see cref="Document"/> (và field mở rộng).</summary>
public static class StgFieldToDocumentMapper
{
    public static void Apply(Document doc, string stgFieldName, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return;
        switch (stgFieldName.ToLowerInvariant())
        {
            case "dc_title":
                doc.Name = value;
                break;
            case "dc_symbol":
                doc.SymbolNo = value;
                break;
            case "dc_receiver":
                doc.IssuedBy = value;
                break;
            case "dc_box":
                doc.Field10 = value;
                break;
            case "dc_num1":
                doc.RecordNo = value;
                break;
            case "dc_date1":
                doc.Field11 = value;
                break;
            case "fc_title":
                doc.Field12 = value;
                break;
            case "fc_end":
                doc.Field13 = value;
                break;
            case "fc_lang":
                doc.Field14 = value;
                break;
            case "fc_start":
                doc.Field15 = value;
                break;
            case "fc_pages":
                doc.Field9 = value;
                break;
            case "fc_store":
                doc.Noted = string.IsNullOrEmpty(doc.Noted) ? value : doc.Noted + "; " + value;
                break;
            case "fc_dec1":
            case "std_text":
            case "std_num":
            case "std_dec":
            case "std_date":
                AppendOverflow(doc, value);
                break;
            default:
                AppendOverflow(doc, value);
                break;
        }
    }

    private static void AppendOverflow(Document doc, string value)
    {
        if (string.IsNullOrEmpty(doc.Field6)) doc.Field6 = value;
        else if (string.IsNullOrEmpty(doc.Field7)) doc.Field7 = value;
        else if (string.IsNullOrEmpty(doc.Field8)) doc.Field8 = value;
        else doc.SearchMeta = (doc.SearchMeta ?? "") + " " + value;
    }
}
