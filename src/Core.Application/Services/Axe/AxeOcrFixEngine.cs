using System.Globalization;
using System.Text;
using Shared.Contracts.Dtos;

namespace Core.Application.Services.Axe;

/// <summary>Port rút gọn Utils.GetOCRFix (AXE) — đủ các kiểu thường dùng.</summary>
public static class AxeOcrFixEngine
{
    public static string Apply(string input, IReadOnlyList<StgDocSoHoaOcrFixDto> fixes, IReadOnlyDictionary<int, string> typeCodeById)
    {
        var s = input ?? "";
        foreach (var fix in fixes)
        {
            if (!typeCodeById.TryGetValue(fix.Type, out var code))
                continue;
            var start = 0;
            var end = s.Length - 1;
            if (fix.ToPosition is int tp)
            {
                if (tp <= 0) end = 0;
                else if (tp > s.Length) end = s.Length - 1;
                else end = tp - 1;
            }
            if (fix.FromPosition is int fp)
            {
                if (fp <= 0) start = 0;
                else if (fp > s.Length) start = s.Length;
                else start = fp - 1;
            }
            if (start > end || s.Length == 0)
                continue;
            var a = start > 0 ? s[..start] : "";
            var mid = s.Substring(start, end + 1 - start);
            var b = end + 1 < s.Length ? s[(end + 1)..] : "";
            mid = ApplyOne(mid, code, fix);
            s = string.Concat(a, mid, b);
        }
        return s;
    }

    private static string ApplyOne(string mid, string code, StgDocSoHoaOcrFixDto fix)
    {
        var from = fix.FromStr ?? "";
        var to = fix.ToStr ?? "";
        return code switch
        {
            "REPLACE" => string.IsNullOrEmpty(from) ? mid : mid.Replace(from, to),
            "REMOVE" => string.IsNullOrEmpty(from) ? "" : mid.Replace(from, ""),
            "INSERT" => from + mid,
            "UPPER" => mid.ToUpperInvariant(),
            "LOWER" => mid.ToLowerInvariant(),
            "CAPITALIZE" => CapitalizeFirst(mid),
            "ONLYNUMBER" => new string(mid.Where(char.IsDigit).ToArray()),
            "ONLYLETTER" => new string(mid.Where(c => char.IsLetter(c) || char.IsWhiteSpace(c)).ToArray()),
            "ONLYNUMBERANDLETTER" => new string(mid.Where(c => char.IsLetterOrDigit(c)).ToArray()),
            "TRIM" => string.IsNullOrEmpty(from) ? mid.Trim() : mid.Trim(from.ToCharArray()),
            _ => mid
        };
    }

    private static string CapitalizeFirst(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        return char.ToUpper(s[0], CultureInfo.InvariantCulture) + s[1..];
    }
}
