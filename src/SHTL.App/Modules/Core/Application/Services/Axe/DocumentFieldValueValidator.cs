using System.Globalization;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

public sealed record FieldValidationError(string FieldKey, string Title, string Message);

public static class DocumentFieldValueValidator
{
    private static readonly NumberStyles NumberStyle = NumberStyles.Number;
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static IReadOnlyList<FieldValidationError> Validate(
        IReadOnlyList<StgDocFieldSettingDto>? settings,
        IReadOnlyDictionary<int, StgDocFieldDto>? fieldMap,
        IDictionary<string, string?>? values)
    {
        var errors = new List<FieldValidationError>();
        if (settings == null || settings.Count == 0) return errors;

        values ??= new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var s in settings)
        {
            if (s.IdField == 1) continue;
            if (s.IsReadOnly) continue;

            StgDocFieldDto? f = null;
            fieldMap?.TryGetValue(s.IdField, out f);
            var rawName = f?.Name;
            var key = StgFieldToDocumentMapper.ResolvePostFieldKey(rawName, s.IdField);
            var title = string.IsNullOrWhiteSpace(s.Title) ? (f?.Title ?? key) : s.Title;
            var isDateLikeField = IsDateLikeField(s, f, title);

            string? rawValue = null;
            foreach (var candidate in StgFieldToDocumentMapper.GetStgSubmitLookupKeys(s.IdField, rawName))
            {
                if (values.TryGetValue(candidate, out var found))
                {
                    rawValue = found;
                    break;
                }
            }

            var v = (rawValue ?? string.Empty).Trim();

            // Trường catalog: không ràng buộc required/min-max/select nhưng vẫn phải đúng kiểu ngày/số nếu có nhập
            // (tránh báo thành công trong khi ApplyValue bỏ qua vì TryParse thất bại).
            if (s.IsCatalog)
            {
                if (string.IsNullOrEmpty(v)) continue;
                if (isDateLikeField && !TryParseStgDate(v, out _))
                    errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải có định dạng ngày dd/MM/yyyy."));
                if (s.IType == 3)
                {
                    var numericCat = v.Replace(',', '.');
                    if (!decimal.TryParse(numericCat, NumberStyle, Invariant, out _))
                        errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải là số."));
                }
                continue;
            }

            if (s.IsRequired && string.IsNullOrEmpty(v))
            {
                errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" là bắt buộc."));
                continue;
            }
            if (string.IsNullOrEmpty(v)) continue;

            switch (s.IType)
            {
                case 3:
                    var numeric = v.Replace(',', '.');
                    if (!decimal.TryParse(numeric, NumberStyle, Invariant, out var dec))
                    {
                        errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải là số."));
                    }
                    else
                    {
                        if (!string.IsNullOrWhiteSpace(s.MinValue)
                            && decimal.TryParse(s.MinValue!.Replace(',', '.'), NumberStyle, Invariant, out var min)
                            && dec < min)
                            errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải ≥ {s.MinValue}."));

                        if (!string.IsNullOrWhiteSpace(s.MaxValue)
                            && decimal.TryParse(s.MaxValue!.Replace(',', '.'), NumberStyle, Invariant, out var max)
                            && dec > max)
                            errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải ≤ {s.MaxValue}."));
                    }
                    break;

                case 5:
                    var options = SplitOptions(s.PatternCustom);
                    if (options.Count > 0
                        && !options.Any(o => string.Equals(o, v, StringComparison.OrdinalIgnoreCase)))
                    {
                        errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" có giá trị \"{v}\" không nằm trong danh sách lựa chọn."));
                    }
                    break;
            }

            if (isDateLikeField && !TryParseStgDate(v, out _))
                errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải có định dạng ngày dd/MM/yyyy."));

            if (s.IType is 1 or 2)
            {
                if (s.MinLen > 0 && v.Length < s.MinLen)
                    errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" cần tối thiểu {s.MinLen} ký tự."));
                if (s.MaxLen > 0 && v.Length > s.MaxLen)
                    errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" tối đa {s.MaxLen} ký tự."));
            }
        }

        return errors;
    }

    /// <summary>
    /// Kiểm tra mọi khóa trong payload map vào cột ngày trong <see cref="StgFieldToDocumentMapper.ApplyValue"/>,
    /// trừ khóa thuộc trường đã cấu hình rõ <b>không</b> phải date (vd. field21 là text).
    /// Đảm bảo không lưu "thành công" khi cấu hình loại tài liệu trống/sai nhưng người dùng vẫn gửi chữ vào ô ngày.
    /// </summary>
    public static IReadOnlyList<FieldValidationError> ValidateStgDatePayloadAgainstApply(
        IReadOnlyList<StgDocFieldSettingDto> settings,
        IReadOnlyDictionary<int, StgDocFieldDto>? fieldMap,
        IDictionary<string, string?> values)
    {
        var errors = new List<FieldValidationError>();
        var nonDatePostKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var s in settings)
        {
            if (s.IdField == 1 || s.IsReadOnly) continue;
            StgDocFieldDto? f = null;
            fieldMap?.TryGetValue(s.IdField, out f);
            var rawName = f?.Name;
            var titleForLike = string.IsNullOrWhiteSpace(s.Title) ? (f?.Title ?? "") : s.Title;
            if (IsDateLikeField(s, f, titleForLike)) continue;

            foreach (var k in StgFieldToDocumentMapper.GetStgSubmitLookupKeys(s.IdField, rawName))
            {
                if (!string.IsNullOrWhiteSpace(k)) nonDatePostKeys.Add(k);
            }
        }

        foreach (var kv in values)
        {
            if (string.IsNullOrWhiteSpace(kv.Value)) continue;
            var key = kv.Key?.Trim() ?? "";
            if (string.IsNullOrEmpty(key)) continue;
            if (nonDatePostKeys.Contains(key)) continue;
            if (!StgFieldToDocumentMapper.StgPostKeyMapsToDateColumn(key)) continue;

            var v = kv.Value.Trim();
            if (!TryParseStgDate(v, out _))
                errors.Add(new FieldValidationError(key, key, $"Trường \"{key}\" phải là ngày hợp lệ (dd/MM/yyyy hoặc yyyy-MM-dd)."));
        }

        return errors;
    }

    public static string FormatErrorsForUser(IReadOnlyList<FieldValidationError> errors)
    {
        if (errors == null || errors.Count == 0) return string.Empty;
        if (errors.Count == 1) return errors[0].Message;
        var lines = errors.Select(e => "- " + e.Message);
        return $"Có {errors.Count} lỗi cần sửa:\n" + string.Join("\n", lines);
    }

    private static List<string> SplitOptions(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .Distinct()
            .ToList();
    }

    /// <summary>Parse ngày giống lúc map vào entity (đồng bộ với <see cref="StgFieldToDocumentMapper.ApplyValue"/>).</summary>
    public static bool TryParseStgDate(string raw, out DateTime parsed)
    {
        var formats = new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "yyyy/MM/dd", "dd-MM-yyyy", "dd.MM.yyyy" };
        return DateTime.TryParseExact(raw, formats, Invariant, DateTimeStyles.None, out parsed);
    }

    private static bool IsDateLikeField(StgDocFieldSettingDto setting, StgDocFieldDto? field, string title)
    {
        if (setting.IType == 4) return true;

        var name = field?.Name ?? string.Empty;
        if (name.Equals("dc_issued", StringComparison.OrdinalIgnoreCase)
            || name.Equals("issued", StringComparison.OrdinalIgnoreCase))
            return true;
        if (ContainsDateToken(name)) return true;

        var datatype = field?.Datatype ?? string.Empty;
        if (datatype.Contains("date", StringComparison.OrdinalIgnoreCase)
            || datatype.Contains("time", StringComparison.OrdinalIgnoreCase))
            return true;

        var format = setting.Format ?? string.Empty;
        if (format.Contains("dd/MM/yyyy", StringComparison.OrdinalIgnoreCase)
            || format.Contains("dd-MM-yyyy", StringComparison.OrdinalIgnoreCase)
            || format.Contains("dd.MM.yyyy", StringComparison.OrdinalIgnoreCase)
            || format.Contains("yyyy-MM-dd", StringComparison.OrdinalIgnoreCase)
            || ContainsDateToken(format))
            return true;

        if (ContainsDateToken(title))
            return true;

        return false;
    }

    private static bool ContainsDateToken(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;

        var normalized = value.Trim();
        return normalized.Contains("date", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("time", StringComparison.OrdinalIgnoreCase)
            || HasToken(normalized, "start")
            || HasToken(normalized, "end")
            || normalized.Contains("ngày", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("ngay", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("thời gian", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("thoi gian", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("bắt đầu", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("bat dau", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("kết thúc", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("ket thuc", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasToken(string value, string token)
    {
        if (value.Equals(token, StringComparison.OrdinalIgnoreCase)) return true;

        return value.Contains("_" + token, StringComparison.OrdinalIgnoreCase)
            || value.Contains(token + "_", StringComparison.OrdinalIgnoreCase)
            || value.Contains("-" + token, StringComparison.OrdinalIgnoreCase)
            || value.Contains(token + "-", StringComparison.OrdinalIgnoreCase)
            || value.Contains(" " + token, StringComparison.OrdinalIgnoreCase)
            || value.Contains(token + " ", StringComparison.OrdinalIgnoreCase);
    }
}
