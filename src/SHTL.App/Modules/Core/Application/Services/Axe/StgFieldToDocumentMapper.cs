using SHTL.Modules.Core.Domain.Entities.Stg;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>
/// Helper để map giữa StgDocField names và Document entity properties
/// </summary>
public static class StgFieldToDocumentMapper
{
    private static string? FirstNotEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    /// <summary>
    /// Khóa POST cho trường động: ưu tiên <paramref name="dbFieldName"/>; nếu rỗng thì suy ra từ id trường (đồng bộ với fallback hiển thị form Extract).
    /// Tránh <c>data-stg-field=""</c> khiến JS bỏ qua và không gửi giá trị lên server.
    /// </summary>
    public static string ResolvePostFieldKey(string? dbFieldName, int fieldId)
    {
        if (!string.IsNullOrWhiteSpace(dbFieldName))
            return dbFieldName.Trim();

        return fieldId switch
        {
            1 => "dc_title",
            2 => "dc_symbol",
            3 => "dc_issued_by",
            4 => "receiver",
            5 => "subject",
            6 => "levelno",
            7 => "boxno",
            8 => "recordno",
            9 => "recordtitle",
            10 => "poster",
            11 => "signer",
            12 => "slotno",
            13 => "shelfno",
            14 => "noted",
            15 => "fc_dec1",
            16 => "fc_date1",
            17 => "std_text",
            18 => "std_num",
            19 => "std_dec",
            20 => "std_date",
            >= 101 and <= 125 => $"field{fieldId - 100}",
            _ => string.Empty
        };
    }

    /// <summary>
    /// Các khóa có thể xuất hiện trong <c>stgFieldValues</c> khi gửi Extract (đồng bộ alias fallback trên Form).
    /// Dùng khi validate để không bỏ sót giá trị do lệch tên khóa hoặc legacy alias (vd. <c>std_date</c> vs <c>field21</c>).
    /// </summary>
    public static IReadOnlyList<string> GetStgSubmitLookupKeys(int fieldId, string? rawName)
    {
        var list = new List<string>();
        void AddDistinct(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return;
            var t = s.Trim();
            if (!list.Exists(x => string.Equals(x, t, StringComparison.OrdinalIgnoreCase)))
                list.Add(t);
        }

        AddDistinct(ResolvePostFieldKey(rawName, fieldId));
        AddDistinct(rawName);
        foreach (var a in GetLegacyStgAliasKeysForFieldId(fieldId))
            AddDistinct(a);

        return list;
    }

    private static IEnumerable<string> GetLegacyStgAliasKeysForFieldId(int fieldId)
    {
        return fieldId switch
        {
            1 => new[] { "dc_title", "name" },
            2 => new[] { "dc_symbol", "symbol_no", "symbolno" },
            3 => new[] { "issuer", "dc_issued_by", "issued_by", "issuedby" },
            4 => new[] { "receiver", "dc_receiver" },
            5 => new[] { "subject", "describe" },
            6 => new[] { "levelno", "dc_box", "level_no" },
            7 => new[] { "boxno", "dc_num1", "box_no", "hop_so" },
            8 => new[] { "recordno", "dc_record", "record_no", "ho_so_so" },
            9 => new[] { "recordtitle", "fc_title", "record_title" },
            10 => new[] { "poster", "author" },
            11 => new[] { "signer" },
            12 => new[] { "slotno", "slot_no" },
            13 => new[] { "shelfno", "shelf_no" },
            14 => new[] { "noted", "dc_noted" },
            15 => new[] { "fc_dec1", "field23" },
            16 => new[] { "fc_date1", "field22" },
            17 => new[] { "std_text", "field15" },
            18 => new[] { "std_num", "field16" },
            19 => new[] { "std_dec", "field23" },
            20 => new[] { "std_date", "field21" },
            >= 101 and <= 125 => new[] { $"field{fieldId - 100}" },
            _ => Array.Empty<string>()
        };
    }

    /// <summary>
    /// Extract giá trị từ Document entity thành dictionary theo field name
    /// </summary>
    public static Dictionary<string, string?> ExtractValues(Document doc)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        // Core fields
        // dc_title always reflects physical file name (stg_documents.file_name)
        values["dc_title"] = string.IsNullOrWhiteSpace(doc.FileName) ? doc.Name : doc.FileName;
        values["name"] = doc.Name;
        values["title"] = values["dc_title"];
        values["dc_symbol"] = doc.SymbolNo;
        values["symbolno"] = doc.SymbolNo;
        values["dc_record"] = doc.RecordNo;
        values["recordno"] = doc.RecordNo;
        values["dc_issued_by"] = doc.IssuedBy;
        values["issuedby"] = doc.IssuedBy;
        values["issuer"] = doc.IssuedBy;
        values["dc_author"] = doc.Author;
        values["author"] = doc.Author;
        values["poster"] = doc.Poster;
        values["dc_issued"] = doc.Issued?.ToString("yyyy-MM-dd");
        values["issued"] = doc.Issued?.ToString("yyyy-MM-dd");
        values["dc_issued_year"] = doc.IssuedYear?.ToString();
        values["issuedyear"] = doc.IssuedYear?.ToString();
        values["dc_noted"] = doc.Noted;
        values["noted"] = doc.Noted;
        values["subject"] = doc.Subject;
        values["signer"] = doc.Signer;
        values["summary"] = doc.Summary;
        values["describe"] = doc.Describe;

        // Extended fields (Field1-25)
        values["field1"] = doc.Field1;
        values["field2"] = doc.Field2;
        values["field3"] = doc.Field3;
        values["field4"] = doc.Field4;
        values["field5"] = doc.Field5;
        values["field6"] = doc.Field6;
        values["field7"] = doc.Field7;
        values["field8"] = doc.Field8;
        values["field9"] = doc.Field9;
        values["field10"] = doc.Field10;
        values["field11"] = doc.Field11;
        values["field12"] = doc.Field12;
        values["field13"] = doc.Field13;
        values["field14"] = doc.Field14;
        values["field15"] = doc.Field15;
        values["field16"] = doc.Field16?.ToString();
        values["field17"] = doc.Field17?.ToString();
        values["field18"] = doc.Field18?.ToString();
        values["field19"] = doc.Field19?.ToString();
        values["field20"] = doc.Field20?.ToString();
        values["field21"] = doc.Field21?.ToString("yyyy-MM-dd");
        values["field22"] = doc.Field22?.ToString("yyyy-MM-dd");
        values["field23"] = doc.Field23?.ToString();
        values["field24"] = doc.Field24?.ToString();
        values["field25"] = doc.Field25?.ToString();

        // Legacy aliases still used by some existing doctype settings.
        values["dc_receiver"] = FirstNotEmpty(doc.Receiver, doc.RecordNo, doc.IssuedBy);
        values["receiver"] = values["dc_receiver"];
        values["dc_box"] = FirstNotEmpty(doc.LevelNo, doc.SymbolNo);
        values["levelno"] = doc.LevelNo;
        values["dc_num1"] = doc.BoxNo;
        values["boxno"] = doc.BoxNo;
        values["dc_date1"] = doc.Field21?.ToString("yyyy-MM-dd");
        values["dc_custom1"] = doc.RecordTitle;
        values["recordtitle"] = doc.RecordTitle;
        values["dc_select1"] = doc.SlotNo;
        values["slotno"] = doc.SlotNo;
        values["fc_title"] = FirstNotEmpty(doc.RecordTitle, doc.RecordNo, doc.Name);
        values["recordno"] = doc.RecordNo;
        values["fc_end"] = doc.Field22?.ToString("yyyy-MM-dd");
        values["fc_lang"] = doc.ShelfNo;
        values["shelfno"] = doc.ShelfNo;
        values["fc_start"] = doc.Field21?.ToString("yyyy-MM-dd");
        values["fc_pages"] = doc.BoxNo;
        values["fc_store"] = doc.LevelNo;
        values["fc_dec1"] = doc.Field23?.ToString();
        values["fc_date1"] = doc.Field22?.ToString("yyyy-MM-dd");
        values["std_text"] = doc.Field15;
        values["std_num"] = doc.Field16?.ToString();
        values["std_dec"] = doc.Field23?.ToString();
        values["std_date"] = doc.Field21?.ToString("yyyy-MM-dd");

        // Extra aliases for variants seen in legacy data.
        values["dc_record_no"] = doc.RecordNo;
        values["record_no"] = doc.RecordNo;
        values["dc_symbol_no"] = doc.SymbolNo;
        values["symbol_no"] = doc.SymbolNo;
        values["dc_issuedby"] = doc.IssuedBy;
        values["issued_by"] = doc.IssuedBy;
        values["ho_so_so"] = FirstNotEmpty(doc.RecordNo, doc.RecordTitle);
        values["hop_so"] = FirstNotEmpty(doc.BoxNo, doc.SymbolNo);
        values["dot_so"] = FirstNotEmpty(doc.LevelNo, doc.RecordNo);

        return values;
    }

    /// <summary>
    /// Apply giá trị từ form vào Document entity dựa trên field name
    /// </summary>
    public static void ApplyValue(Document doc, string fieldName, string? value)
    {
        if (string.IsNullOrWhiteSpace(fieldName)) return;

        var trimmed = fieldName.Trim();
        var canonical = GetFieldNameForLegacyField(trimmed);
        if (canonical != null &&
            !string.Equals(canonical, trimmed, StringComparison.OrdinalIgnoreCase))
        {
            ApplyValue(doc, canonical, value);
            return;
        }

        switch (trimmed.ToLowerInvariant())
        {
            case "dc_title":
            case "title":
            case "name":
                doc.Name = value ?? "";
                break;
            case "dc_symbol":
            case "symbolno":
            case "symbol_no":
            case "dc_symbol_no":
                doc.SymbolNo = value;
                break;
            case "dc_record":
            case "recordno":
            case "record_no":
            case "dc_record_no":
                doc.RecordNo = value;
                break;
            case "dc_issued_by":
            case "issuer":
            case "issuedby":
            case "issued_by":
            case "dc_issuedby":
                doc.IssuedBy = value;
                break;
            case "dc_author":
            case "author":
                doc.Author = value;
                break;
            case "poster":
                doc.Poster = value;
                break;
            case "signer":
                doc.Signer = value;
                break;
            case "dc_issued":
            case "issued":
                if (DocumentFieldValueValidator.TryParseStgDate(value ?? "", out var issued))
                    doc.Issued = issued;
                break;
            case "dc_issued_year":
            case "issuedyear":
            case "issued_year":
                if (int.TryParse(value, out var year))
                    doc.IssuedYear = year;
                break;
            case "dc_noted":
            case "noted":
                doc.Noted = value;
                break;
            case "describe":
                doc.Describe = value;
                break;
            case "summary":
                doc.Summary = value;
                break;
            case "subject":
                doc.Subject = value;
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
            case "field9":
                doc.Field9 = value;
                break;
            case "field10":
                doc.Field10 = value;
                break;
            case "field11":
                doc.Field11 = value;
                break;
            case "field12":
                doc.Field12 = value;
                break;
            case "field13":
                doc.Field13 = value;
                break;
            case "field14":
                doc.Field14 = value;
                break;
            case "field15":
                doc.Field15 = value;
                break;
            case "field16":
                if (long.TryParse(value, out var f16))
                    doc.Field16 = f16;
                break;
            case "field17":
                if (long.TryParse(value, out var f17))
                    doc.Field17 = f17;
                break;
            case "field18":
                if (long.TryParse(value, out var f18))
                    doc.Field18 = f18;
                break;
            case "field19":
                if (long.TryParse(value, out var f19))
                    doc.Field19 = f19;
                break;
            case "field20":
                if (long.TryParse(value, out var f20))
                    doc.Field20 = f20;
                break;
            case "field21":
                if (DocumentFieldValueValidator.TryParseStgDate(value ?? "", out var f21))
                    doc.Field21 = f21;
                break;
            case "field22":
                if (DocumentFieldValueValidator.TryParseStgDate(value ?? "", out var f22))
                    doc.Field22 = f22;
                break;
            case "field23":
                if (decimal.TryParse(value, out var f23))
                    doc.Field23 = f23;
                break;
            case "field24":
                if (decimal.TryParse(value, out var f24))
                    doc.Field24 = f24;
                break;
            case "field25":
                if (decimal.TryParse(value, out var f25))
                    doc.Field25 = f25;
                break;

            // Legacy aliases
            case "dc_receiver":
            case "receiver":
                doc.Receiver = value;
                break;
            case "dc_box":
            case "levelno":
            case "fc_store":
            case "dot_so":
                doc.LevelNo = value;
                break;
            case "dc_num1":
            case "boxno":
            case "fc_pages":
            case "hop_so":
                doc.BoxNo = value;
                break;
            case "dc_custom1":
            case "recordtitle":
            case "fc_title":
                doc.RecordTitle = value;
                break;
            case "dc_select1":
            case "slotno":
                doc.SlotNo = value;
                break;
            case "fc_lang":
            case "shelfno":
                doc.ShelfNo = value;
                break;
            case "std_text":
                doc.Field15 = value;
                break;
            case "std_num":
                if (long.TryParse(value, out var stdNum))
                    doc.Field16 = stdNum;
                break;
            case "dc_date1":
            case "fc_start":
            case "std_date":
                if (DocumentFieldValueValidator.TryParseStgDate(value ?? "", out var d1))
                    doc.Field21 = d1;
                break;
            case "fc_end":
            case "fc_date1":
                if (DocumentFieldValueValidator.TryParseStgDate(value ?? "", out var d2))
                    doc.Field22 = d2;
                break;
            case "fc_dec1":
            case "std_dec":
                if (decimal.TryParse(value, out var dec))
                    doc.Field23 = dec;
                break;
            case "ho_so_so":
                doc.RecordNo = value;
                break;
        }
    }

    /// <summary>
    /// Khóa trong <c>stgFieldValues</c> mà <see cref="ApplyValue"/> map vào cột kiểu ngày trên entity (Field21/Field22/Issued).
    /// Dùng để validate payload kể cả khi cấu hình loại tài liệu thiếu/thiếu <c>i_type</c> = date.
    /// </summary>
    public static bool StgPostKeyMapsToDateColumn(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;
        return key.Trim().ToLowerInvariant() switch
        {
            "dc_issued" or "issued"
                or "field21" or "field22"
                or "dc_date1" or "fc_start" or "std_date"
                or "fc_end" or "fc_date1" => true,
            _ => false,
        };
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
        return legacyFieldName.Trim().ToLowerInvariant() switch
        {
            "name" => "dc_title",
            "symbolno" => "dc_symbol",
            "symbol_no" => "dc_symbol",
            "dc_symbol_no" => "dc_symbol",
            "recordno" => "dc_record",
            "record_no" => "dc_record",
            "dc_record_no" => "dc_record",
            "issuedby" => "dc_issued_by",
            "issued_by" => "dc_issued_by",
            "dc_issuedby" => "dc_issued_by",
            "author" => "dc_author",
            "issued" => "dc_issued",
            "issuedyear" => "dc_issued_year",
            "issued_year" => "dc_issued_year",
            "noted" => "dc_noted",
            _ => null
        };
    }
}
