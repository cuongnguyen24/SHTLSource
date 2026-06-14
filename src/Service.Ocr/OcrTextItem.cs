using System.Text.Json.Serialization;

namespace SHTL.Service.Ocr;

internal sealed class OcrTextItem
{
    [JsonPropertyName("pageNumber")]
    public int PageNumber { get; set; }

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("xStartRatio")]
    public float XStartRatio { get; set; }

    [JsonPropertyName("xEndRatio")]
    public float XEndRatio { get; set; }

    [JsonPropertyName("yTopRatio")]
    public float YTopRatio { get; set; }

    [JsonPropertyName("yBottomRatio")]
    public float YBottomRatio { get; set; }

    [JsonPropertyName("baselineY")]
    public float BaselineY { get; set; }
}
