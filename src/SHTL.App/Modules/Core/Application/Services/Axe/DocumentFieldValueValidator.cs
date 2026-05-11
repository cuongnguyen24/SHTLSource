using System.Globalization;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

public sealed record FieldValidationError(string FieldKey, string Title, string Message);

/// <summary>
/// Validate giá trị nhập liệu cho từng cấu hình trường (IType, MinValue/MaxValue, MinLen/MaxLen, Select options).
/// Thiết kế để gọi ngay trước khi map vào entity Document.
/// </summary>
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
            if (s.IsCatalog) continue;
            if (s.IdField == 1) continue; // Tên = file name, không cho user sửa
            if (s.IsReadOnly) continue;

            StgDocFieldDto? f = null;
            fieldMap?.TryGetValue(s.IdField, out f);
            var rawName = f?.Name;
            var key = StgFieldToDocumentMapper.ResolvePostFieldKey(rawName, s.IdField);
            var title = string.IsNullOrWhiteSpace(s.Title) ? (f?.Title ?? key) : s.Title;

            // Server có thể nhận theo PostKey hoặc theo FieldName trực tiếp.
            string? rawValue = null;
            if (!values.TryGetValue(key, out rawValue) && !string.IsNullOrEmpty(rawName))
                values.TryGetValue(rawName, out rawValue);

            var v = (rawValue ?? string.Empty).Trim();

            if (s.IsRequired && string.IsNullOrEmpty(v))
            {
                errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" là bắt buộc."));
                continue;
            }

            if (string.IsNullOrEmpty(v)) continue;

            switch (s.IType)
            {
                case 3: // number
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

                case 4: // date
                    if (!TryParseDate(v, out _))
                        errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" phải có định dạng ngày dd/MM/yyyy."));
                    break;

                case 5: // select
                    var options = SplitOptions(s.PatternCustom);
                    if (options.Count > 0
                        && !options.Any(o => string.Equals(o, v, StringComparison.OrdinalIgnoreCase)))
                    {
                        errors.Add(new FieldValidationError(key, title, $"Trường \"{title}\" có giá trị \"{v}\" không nằm trong danh sách lựa chọn."));
                    }
                    break;
            }

            // Ràng buộc độ dài cho text/textarea (IType 1, 2).
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

    public static string FormatErrorsForUser(IReadOnlyList<FieldValidationError> errors)
    {
        if (errors == null || errors.Count == 0) return string.Empty;
        if (errors.Count == 1) return errors[0].Message;
        var lines = errors.Select(e => "• " + e.Message);
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

    private static bool TryParseDate(string raw, out DateTime parsed)
    {
        var formats = new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "yyyy/MM/dd", "dd-MM-yyyy" };
        return DateTime.TryParseExact(raw, formats, Invariant, DateTimeStyles.None, out parsed)
            || DateTime.TryParse(raw, Invariant, DateTimeStyles.None, out parsed);
    }
}
