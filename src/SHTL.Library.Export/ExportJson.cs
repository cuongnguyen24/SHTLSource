using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SHTL.Exporting;

public static class ExportJson
{
    public static JsonSerializerOptions DeserializeOptions { get; } = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    /// <summary>
    /// Ghi UTF-8 trực tiếp (không escape \uXXXX) — phù hợp JsonConfig tiếng Việt sau ExcelToJsonConverter.
    /// Deserialize vẫn đọc được cả hai dạng.
    /// </summary>
    public static JsonSerializerOptions SerializeOptions { get; } = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };
}
