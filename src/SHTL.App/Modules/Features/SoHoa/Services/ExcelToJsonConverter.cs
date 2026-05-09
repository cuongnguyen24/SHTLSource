using ClosedXML.Excel;
using SHTL.Exporting;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace SHTL.Modules.Features.SoHoa.Services;

/// <summary>
/// Excel cấu hình export → JSON (AXE: DocProSoHoa.Customs.Utilities.ExcelToJsonConverter).
/// Dùng tại SoHoa / Cấu hình loại xuất.
/// </summary>
public class ExcelToJsonConverter
{
    private readonly ILogger<ExcelToJsonConverter> _logger;

    public ExcelToJsonConverter(ILogger<ExcelToJsonConverter> logger)
    {
        _logger = logger;
    }

    public Task<string> ConvertAsync(string excelPath, string? projectName = null)
    {
        return Task.Run(() =>
        {
            var cfg = BuildConfiguration(excelPath, projectName);
            return SerializeForExcelExportTypeForm(cfg);
        });
    }

    /// <summary>
    /// JSON gọn cho form loại xuất: bỏ mảng/object rỗng và field mặc định không cần thiết (giữ tương thích deserialize).
    /// </summary>
    private static string SerializeForExcelExportTypeForm(ExportConfiguration cfg)
    {
        var opts = new JsonSerializerOptions(ExportJson.SerializeOptions);
        var node = JsonSerializer.SerializeToNode(cfg, opts);
        PruneExcelExportConfigNode(node);
        return node?.ToJsonString(opts)
               ?? JsonSerializer.Serialize(cfg, opts);
    }

    private static void PruneExcelExportConfigNode(JsonNode? root)
    {
        if (root is not JsonObject o)
            return;

        RemovePropertyIfEmptyArray(o, "DefaultDocTypeIds");
        RemovePropertyIfEmptyArray(o, "ExcelFiles");

        if (TryGetBool(o, "UsePathBasedStructure", out var ups) && !ups)
            o.Remove("UsePathBasedStructure");

        RemovePropertyIfNullOrEmptyString(o, "PathStructurePattern");

        if (o.TryGetPropertyValue("CustomSettings", out var csNode) &&
            csNode is JsonObject csObj &&
            csObj.Count == 0)
            o.Remove("CustomSettings");

        if (o.TryGetPropertyValue("CoverConfig", out var cc) &&
            cc is JsonObject ccObj &&
            ccObj.Count == 0)
            o.Remove("CoverConfig");

        if (o.TryGetPropertyValue("DataMapping", out var dmNode) && dmNode is JsonObject dm)
            PruneDataMappingForExcel(dm);
    }

    private static void PruneDataMappingForExcel(JsonObject dm)
    {
        RemovePropertyIfEmptyArray(dm, "StaticMappings");
        RemovePropertyIfEmptyArray(dm, "StaticMappings1");
        RemovePropertyIfEmptyArray(dm, "StaticMappings2");
        RemovePropertyIfEmptyArray(dm, "StaticMappings3");
        RemovePropertyIfEmptyArray(dm, "StaticMappings4");
        RemovePropertyIfEmptyObject(dm, "StaticMappingsDict");
        RemovePropertyIfDefaultString(dm, "DynamicMappingSource", "StgDocFieldSetting");
        RemovePropertyIfDefaultString(dm, "StaticMappingPriority", "After");
    }

    private static void RemovePropertyIfEmptyArray(JsonObject o, string name)
    {
        if (o.TryGetPropertyValue(name, out var n) && n is JsonArray a && a.Count == 0)
            o.Remove(name);
    }

    private static void RemovePropertyIfEmptyObject(JsonObject o, string name)
    {
        if (o.TryGetPropertyValue(name, out var n) && n is JsonObject ob && ob.Count == 0)
            o.Remove(name);
    }

    private static void RemovePropertyIfDefaultString(JsonObject o, string name, string defaultValue)
    {
        if (!o.TryGetPropertyValue(name, out var n) || n is not JsonValue jv)
            return;
        if (jv.TryGetValue<string>(out var s) && string.Equals(s, defaultValue, StringComparison.Ordinal))
            o.Remove(name);
    }

    private static void RemovePropertyIfNullOrEmptyString(JsonObject o, string name)
    {
        if (!o.TryGetPropertyValue(name, out var n) || n is null)
            return;
        if (n is JsonValue jv && jv.TryGetValue<string>(out var s) && string.IsNullOrEmpty(s))
            o.Remove(name);
    }

    private static bool TryGetBool(JsonObject o, string name, out bool value)
    {
        value = false;
        if (!o.TryGetPropertyValue(name, out var n) || n is not JsonValue jv)
            return false;
        return jv.TryGetValue(out value);
    }

    private ExportConfiguration BuildConfiguration(string excelPath, string? projectName)
    {
        if (string.IsNullOrEmpty(excelPath) || !File.Exists(excelPath))
            throw new FileNotFoundException($"Không tìm thấy file Excel: {excelPath}");

        try
        {
            using var workbook = new XLWorkbook(excelPath);
            var configState = ReadConfigSheet(workbook);
            ReadDataMappingSheet(workbook, configState.Config);

            if (configState.CoverMatchFromConfig != null)
                configState.Config.DataMapping.CoverMatchConfig = configState.CoverMatchFromConfig;

            if (!string.IsNullOrEmpty(projectName))
                configState.Config.ProjectName = projectName;

            return configState.Config;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExcelToJsonConverter BuildConfiguration failed");
            throw new InvalidOperationException($"Lỗi khi chuyển đổi Excel sang JSON: {ex.Message}", ex);
        }
    }

    private sealed class ConfigSheetState
    {
        public ExportConfiguration Config { get; } = new();
        public CoverMatchConfig? CoverMatchFromConfig { get; set; }
    }

    /// <summary>Sheet DataMapping — theo tên (AXE/KBNN) hoặc sheet đầu tiên.</summary>
    private static IXLWorksheet GetDataMappingWorksheet(XLWorkbook workbook)
    {
        var byName = workbook.Worksheets.FirstOrDefault(w =>
            string.Equals(w.Name.Trim(), "DataMapping", StringComparison.OrdinalIgnoreCase));
        return byName ?? workbook.Worksheet(1);
    }

    /// <summary>Sheet cấu hình — hỗ trợ "Config đầu vào", "Config", hoặc sheet thứ 2.</summary>
    private static IXLWorksheet GetConfigWorksheet(XLWorkbook workbook)
    {
        foreach (var name in new[] { "Config đầu vào", "Config", "CONFIG" })
        {
            var found = workbook.Worksheets.FirstOrDefault(w =>
                string.Equals(w.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
            if (found != null) return found;
        }

        if (workbook.Worksheets.Count >= 2)
            return workbook.Worksheet(2);

        throw new InvalidOperationException(
            "Không tìm thấy sheet cấu hình (ví dụ: \"Config đầu vào\" hoặc \"Config\").");
    }

    /// <summary>Đọc ô Excel: bool/number/date/text — tránh mất giá trị khi dùng GetString() (ví dụ CacheEnabled, SoThuMuc).</summary>
    private static string CellAsInvariantText(IXLCell cell)
    {
        if (cell.IsEmpty()) return "";
        var v = cell.Value;
        if (v.IsBlank) return "";
        if (v.IsBoolean) return v.GetBoolean() ? "TRUE" : "FALSE";
        if (v.IsNumber)
        {
            var n = v.GetNumber();
            if (Math.Abs(n % 1) < 1e-9)
                return ((long)Math.Round(n, MidpointRounding.AwayFromZero)).ToString(CultureInfo.InvariantCulture);
            return n.ToString("G", CultureInfo.InvariantCulture);
        }

        if (v.IsText) return v.GetText().Trim();
        if (v.IsDateTime) return v.GetDateTime().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        return cell.GetFormattedString().Trim();
    }

    private static string NormVi(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        return s.Trim().Replace('\u00A0', ' ').Trim().Normalize(NormalizationForm.FormC);
    }

    private static bool ViEquals(string? a, string b) =>
        string.Equals(NormVi(a), NormVi(b), StringComparison.OrdinalIgnoreCase);

    private ConfigSheetState ReadConfigSheet(XLWorkbook workbook)
    {
        var state = new ConfigSheetState();
        var config = state.Config;

        if (workbook.Worksheets.Count < 1)
            throw new InvalidOperationException("Workbook không có worksheet.");

        var configSheet = GetConfigWorksheet(workbook);
        var rows = configSheet.RowsUsed();
        var fieldFolderMappings = new List<FieldFolderMapping>();
        var coverMatchConfig = new Dictionary<string, object?>();
        var inFieldFolderMappings = false;
        var foundSeparator = false;

        foreach (var row in rows)
        {
            var key = CellAsInvariantText(row.Cell(1));
            var value = CellAsInvariantText(row.Cell(2));
            var type = CellAsInvariantText(row.Cell(3));

            if (row.RowNumber() == 1 || key.Equals("KEY", StringComparison.OrdinalIgnoreCase))
                continue;

            if (key == "---" || value == "---")
            {
                foundSeparator = true;
                inFieldFolderMappings = false;
                continue;
            }

            if (foundSeparator && !inFieldFolderMappings)
            {
                var col1 = CellAsInvariantText(row.Cell(1));
                var col2 = CellAsInvariantText(row.Cell(2));
                var col3 = CellAsInvariantText(row.Cell(3));
                var col4 = CellAsInvariantText(row.Cell(4));
                var headerCount = 0;
                if (col1.Equals("LEVEL", StringComparison.OrdinalIgnoreCase)) headerCount++;
                if (col2.Equals("FIELDNAME", StringComparison.OrdinalIgnoreCase)) headerCount++;
                if (col3.Equals("TITLE", StringComparison.OrdinalIgnoreCase)) headerCount++;
                if (col4.Equals("CONFIGKEY", StringComparison.OrdinalIgnoreCase)) headerCount++;
                if (headerCount >= 2)
                {
                    inFieldFolderMappings = true;
                    continue;
                }
            }

            if (inFieldFolderMappings)
            {
                var level = CellAsInvariantText(row.Cell(1));
                var fieldName = CellAsInvariantText(row.Cell(2));
                var title = CellAsInvariantText(row.Cell(3));
                var configKey = CellAsInvariantText(row.Cell(4));
                if (!string.IsNullOrEmpty(level) && int.TryParse(level, out var levelInt))
                {
                    fieldFolderMappings.Add(new FieldFolderMapping
                    {
                        Level = levelInt,
                        FieldName = fieldName,
                        Title = title,
                        ConfigKey = configKey
                    });
                }
                continue;
            }

            if (key.StartsWith("CoverMatchConfig.", StringComparison.OrdinalIgnoreCase))
            {
                var propertyName = key["CoverMatchConfig.".Length..];
                coverMatchConfig[propertyName] = ParseValue(value, type);
                continue;
            }

            if (!string.IsNullOrEmpty(key) && !inFieldFolderMappings)
                ApplyRootConfigKey(config, key, ParseValue(value, type));
        }

        if (fieldFolderMappings.Count > 0)
            config.FieldFolderMappings = fieldFolderMappings;

        if (coverMatchConfig.Count > 0)
        {
            if (coverMatchConfig.TryGetValue("PathMatchLevels", out var pml) && pml is string pathMatchLevelsStr)
            {
                var levels = pathMatchLevelsStr.Split(',')
                    .Select(s => int.TryParse(s.Trim(), out var v) ? v : 0)
                    .Where(v => v > 0)
                    .ToList();
                coverMatchConfig["PathMatchLevels"] = levels;
            }

            if (coverMatchConfig.TryGetValue("CacheEnabled", out var ce))
            {
                if (ce is string cacheEnabledStr)
                {
                    coverMatchConfig["CacheEnabled"] = cacheEnabledStr.Equals("TRUE", StringComparison.OrdinalIgnoreCase)
                        || cacheEnabledStr.Equals("true", StringComparison.OrdinalIgnoreCase)
                        || cacheEnabledStr.Equals("1");
                }
            }

            state.CoverMatchFromConfig = MapCoverMatch(coverMatchConfig);
        }

        return state;
    }

    private static CoverMatchConfig MapCoverMatch(Dictionary<string, object?> src)
    {
        var c = new CoverMatchConfig();
        if (src.TryGetValue("FileName", out var fn) && fn != null) c.FileName = fn.ToString();
        if (src.TryGetValue("MatchStrategy", out var ms) && ms != null) c.MatchStrategy = ms.ToString() ?? c.MatchStrategy;
        if (src.TryGetValue("PathMatchLevels", out var pml) && pml != null)
        {
            switch (pml)
            {
                case List<int> li:
                    c.PathMatchLevels = li;
                    break;
                case int[] arr:
                    c.PathMatchLevels = arr.ToList();
                    break;
                case IEnumerable<int> ie:
                    c.PathMatchLevels = ie.ToList();
                    break;
            }
        }
        if (src.TryGetValue("CacheEnabled", out var ce) && ce is bool b) c.CacheEnabled = b;
        return c;
    }

    private static int ObjectToInt32(object? parsedValue, int defaultValue)
    {
        if (parsedValue == null)
            return defaultValue;
        if (parsedValue is int i)
            return i;
        if (parsedValue is long l)
            return (int)l;
        var s = parsedValue.ToString()?.Trim();
        if (string.IsNullOrEmpty(s))
            return defaultValue;
        return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
            ? n
            : defaultValue;
    }

    private static int? ObjectToNullableInt32(object? parsedValue)
    {
        if (parsedValue == null)
            return null;
        if (parsedValue is int i)
            return i;
        var s = parsedValue.ToString()?.Trim();
        if (string.IsNullOrEmpty(s))
            return null;
        return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    private static bool ObjectToBool(object? parsedValue, bool defaultValue = false)
    {
        if (parsedValue == null)
            return defaultValue;
        if (parsedValue is bool b)
            return b;
        var s = parsedValue.ToString()?.Trim();
        if (string.IsNullOrEmpty(s))
            return defaultValue;
        if (bool.TryParse(s, out var pb))
            return pb;
        if (s.Equals("TRUE", StringComparison.OrdinalIgnoreCase) || s.Equals("1", StringComparison.Ordinal))
            return true;
        if (s.Equals("FALSE", StringComparison.OrdinalIgnoreCase) || s.Equals("0", StringComparison.Ordinal))
            return false;
        return defaultValue;
    }

    private static void ApplyRootConfigKey(ExportConfiguration config, string key, object? parsedValue)
    {
        switch (key)
        {
            case "ThuMucGoc":
                config.ThuMucGoc = parsedValue?.ToString();
                break;
            case "ThuMucGocConfigKey":
                config.ThuMucGocConfigKey = parsedValue?.ToString();
                break;
            case "SoThuMuc":
                config.SoThuMuc = ObjectToInt32(parsedValue, 0);
                break;
            case "SoThuMucConfigKey":
                config.SoThuMucConfigKey = parsedValue?.ToString();
                break;
            case "DefaultIDBia":
                config.DefaultIDBia = ObjectToInt32(parsedValue, 1);
                break;
            case "DefaultIDVanBan":
                config.DefaultIDVanBan = ObjectToInt32(parsedValue, 2);
                break;
            case "DefaultIDMucLuc":
                config.DefaultIDMucLuc = ObjectToNullableInt32(parsedValue);
                break;
            case "DefaultIDOther1":
                config.DefaultIDOther1 = ObjectToNullableInt32(parsedValue);
                break;
            case "UsePathBasedStructure":
                config.UsePathBasedStructure = ObjectToBool(parsedValue, false);
                break;
            case "PathStructurePattern":
                config.PathStructurePattern = parsedValue?.ToString();
                break;
            case "XuatFileVatLyDoiTen":
                var xv = parsedValue?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(xv)) config.XuatFileVatLyDoiTen = xv;
                break;
            case "ProjectName":
                config.ProjectName = parsedValue?.ToString() ?? "";
                break;
        }
    }

    private void ReadDataMappingSheet(XLWorkbook workbook, ExportConfiguration cfg)
    {
        if (workbook.Worksheets.Count < 1)
            throw new InvalidOperationException("File Excel phải có ít nhất Sheet 1: DataMapping");

        var sheet = GetDataMappingWorksheet(workbook);
        var rows = sheet.RowsUsed().ToList();
        cfg.DataMapping.UseDynamicMapping = false;

        var headerRow1 = rows.FirstOrDefault(r => r.RowNumber() == 1);
        if (headerRow1 == null) return;

        var columnMap = new Dictionary<string, int>();
        var maxColumn = headerRow1.LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (var col = 1; col <= maxColumn; col++)
        {
            var headerValue = CellAsInvariantText(headerRow1.Cell(col));
            if (!string.IsNullOrEmpty(headerValue))
                columnMap[headerValue] = col;
        }

        var headerRow2 = rows.FirstOrDefault(r => r.RowNumber() == 2);
        if (headerRow2 != null)
        {
            maxColumn = Math.Max(maxColumn, headerRow2.LastCellUsed()?.Address.ColumnNumber ?? 0);
            for (var col = 1; col <= maxColumn; col++)
            {
                var headerValue = CellAsInvariantText(headerRow2.Cell(col));
                if (!string.IsNullOrEmpty(headerValue))
                    columnMap[headerValue] = col;
            }
        }

        var coverMappings = new List<StaticDataMapping>();
        var documentMappings = new List<StaticDataMapping>();
        var isDocumentMappings = false;
        var columnTitleCount = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows.Where(r => r.RowNumber() > 2))
        {
            var mapping = ReadMappingRow(row, columnMap);
            if (mapping == null) continue;

            if (mapping.ColumnTitle is { } columnTitle)
            {
                var normalizedTitle = columnTitle.Trim();
                var baseName = normalizedTitle;
                var existingNumber = 0;
                var match = Regex.Match(normalizedTitle, @"^(.+?)\s+(\d+)$");
                if (match.Success)
                {
                    baseName = match.Groups[1].Value.Trim();
                    int.TryParse(match.Groups[2].Value, out existingNumber);
                }

                if (existingNumber > 0)
                {
                    if (columnTitleCount.TryGetValue(baseName, out var cur))
                    {
                        if (existingNumber > cur) columnTitleCount[baseName] = existingNumber;
                    }
                    else columnTitleCount[baseName] = existingNumber;
                }
                else
                {
                    if (columnTitleCount.ContainsKey(baseName))
                    {
                        columnTitleCount[baseName]++;
                        mapping.ColumnTitle = $"{baseName} {columnTitleCount[baseName]}";
                    }
                    else columnTitleCount[baseName] = 1;
                }
            }

            var taiLieuHoSo = GetCellValue(row, columnMap, "TÀI LIỆU/HỒ SƠ");
            if (ViEquals(taiLieuHoSo, "Tài liệu"))
                isDocumentMappings = true;

            if (isDocumentMappings)
                documentMappings.Add(mapping);
            else if (ViEquals(taiLieuHoSo, "Hồ sơ"))
                coverMappings.Add(mapping);
        }

        cfg.DataMapping.CoverMappings = coverMappings;
        cfg.DataMapping.DocumentMappings = documentMappings;
    }

    private static StaticDataMapping? ReadMappingRow(IXLRow row, Dictionary<string, int> columnMap)
    {
        var mapping = new StaticDataMapping();
        var columnKey = GetCellValue(row, columnMap, "KEY");
        if (string.IsNullOrEmpty(columnKey)) return null;
        mapping.ColumnKey = columnKey;

        var columnTitle = GetCellValue(row, columnMap, "TÊN TRƯỜNG XUẤT");
        if (!string.IsNullOrEmpty(columnTitle))
            mapping.ColumnTitle = columnTitle;

        var thuTu = GetCellValue(row, columnMap, "THỨ TỰ");
        if (!string.IsNullOrEmpty(thuTu) && int.TryParse(thuTu, out var order))
            mapping.Order = order;

        var anHien = GetCellValue(row, columnMap, "ẨN / HIỆN");
        if (ViEquals(anHien, "Ẩn"))
            mapping.Hide = true;

        var showInfoBia = ParseNullableBoolFromExcel(GetCellValue(row, columnMap, "SHOWINFOBIA"));
        if (showInfoBia.HasValue) mapping.IsShowInfoBia = showInfoBia.Value;

        var showInfoMucLuc = ParseNullableBoolFromExcel(GetCellValue(row, columnMap, "SHOWINFOMUCLUC"));
        if (showInfoMucLuc.HasValue) mapping.IsShowInfoMucLuc = showInfoMucLuc.Value;

        var showInfoOther1 = ParseNullableBoolFromExcel(GetCellValue(row, columnMap, "SHOWINFOOTHER1"));
        if (showInfoOther1.HasValue) mapping.IsShowInfoOther1 = showInfoOther1.Value;

        var loaiDacBiet = GetCellValue(row, columnMap, "LOẠI (ĐẶC BIỆT)");
        if (!string.IsNullOrEmpty(loaiDacBiet))
            mapping.Transform = loaiDacBiet.Trim();

        var field = GetCellValue(row, columnMap, "FIELD");
        if (!string.IsNullOrEmpty(field) && !field.Contains('('))
            mapping.SourceField = field;
        else
            mapping.SourceField = "";

        var macDinh = GetCellValue(row, columnMap, "MẶC ĐỊNH");
        if (!string.IsNullOrEmpty(macDinh))
        {
            var isPattern = (macDinh.Contains('(') && macDinh.Contains(')')) ||
                            (macDinh.Contains('{') && macDinh.Contains('}'));
            if (!isPattern)
            {
                var defaultValue = macDinh.Trim();
                if (defaultValue.Equals("Để trống", StringComparison.OrdinalIgnoreCase))
                    defaultValue = "";
                mapping.DefaultValue = defaultValue;
            }
        }
        else
            mapping.DefaultValue = "";

        var formatMerge = GetCellValue(row, columnMap, "FORMAT(MERGE)");
        if (!string.IsNullOrEmpty(formatMerge))
        {
            var isPattern = (formatMerge.Contains('(') && formatMerge.Contains(')')) ||
                            (formatMerge.Contains('{') && formatMerge.Contains('}'));
            if (isPattern)
            {
                var pattern = formatMerge;
                if (formatMerge.Contains('(') && formatMerge.Contains(')'))
                    pattern = formatMerge.Replace("(", "{", StringComparison.Ordinal).Replace(")", "}", StringComparison.Ordinal);
                pattern = NormalizeBackslash(pattern);
                var separator = "_";
                if (pattern.Contains('\\')) separator = "\\";
                else if (pattern.Contains('/')) separator = "/";
                else if (pattern.Contains('.') && !pattern.Contains('{')) separator = ".";

                mapping.MergeConfig = new FieldMergeConfig
                {
                    Pattern = pattern,
                    Separator = separator,
                    SkipEmptyFields = false
                };
            }
        }

        var lookupMode = GetCellValue(row, columnMap, "LOOKUPMODE");
        var lookupFile = GetCellValue(row, columnMap, "LOOKUPFILE");
        var mappingFile = !string.IsNullOrEmpty(lookupFile)
            ? lookupFile
            : GetCellValue(row, columnMap, "MAPPINGFILE");
        if (!string.IsNullOrEmpty(mappingFile) && mappingFile != "0" && !int.TryParse(mappingFile, out _))
        {
            mappingFile = NormalizeBackslash(mappingFile);
            var sourceColumn = GetCellValue(row, columnMap, "SOURCECOLUMN");
            var targetColumn = GetCellValue(row, columnMap, "TARGETCOLUMN");
            var keyColumn1 = GetCellValue(row, columnMap, "KEYCOLUMN1");
            var keySource1 = GetCellValue(row, columnMap, "KEYSOURCE1");
            var keyColumn2 = GetCellValue(row, columnMap, "KEYCOLUMN2");
            var keySource2 = GetCellValue(row, columnMap, "KEYSOURCE2");
            var returnColumn = GetCellValue(row, columnMap, "RETURNCOLUMN");

            mapping.TransformConfig = new ValueTransformConfig
            {
                MappingFile = mappingFile,
                SourceColumn = sourceColumn ?? "",
                TargetColumn = targetColumn ?? "",
                LookupMode = lookupMode ?? "",
                KeyColumn1 = keyColumn1 ?? "",
                KeySource1 = keySource1 ?? "",
                KeyColumn2 = keyColumn2 ?? "",
                KeySource2 = keySource2 ?? "",
                ReturnColumn = returnColumn ?? "",
                CaseSensitive = false,
                DefaultValue = ""
            };
        }

        var caseFormat = GetCellValue(row, columnMap, "CASE_FORMAT");
        var normalizedCaseFormat = NormalizeCaseFormat(caseFormat);
        if (!string.IsNullOrEmpty(normalizedCaseFormat))
            mapping.FormatConfig = new StringFormatConfig { Case = normalizedCaseFormat };

        var paddingType = GetCellValue(row, columnMap, "TYPE(LEFT, RIGHT)");
        var soKyTu = GetCellValue(row, columnMap, "SỐ KÝ TỰ");
        var kyTu = GetCellValue(row, columnMap, "KÝ TỰ");
        var hasValidPadding = (!string.IsNullOrEmpty(paddingType) &&
                               (paddingType.Equals("Left", StringComparison.OrdinalIgnoreCase) ||
                                paddingType.Equals("Right", StringComparison.OrdinalIgnoreCase))) ||
                              (!string.IsNullOrEmpty(soKyTu) && int.TryParse(soKyTu, out _)) ||
                              !string.IsNullOrEmpty(kyTu);
        if (hasValidPadding)
        {
            var paddingConfig = new PaddingConfig();
            if (!string.IsNullOrEmpty(paddingType) &&
                (paddingType.Equals("Left", StringComparison.OrdinalIgnoreCase) ||
                 paddingType.Equals("Right", StringComparison.OrdinalIgnoreCase)))
                paddingConfig.Position = paddingType;
            if (!string.IsNullOrEmpty(soKyTu) && int.TryParse(soKyTu, out var totalLength))
                paddingConfig.TotalLength = totalLength;
            if (!string.IsNullOrEmpty(kyTu))
                paddingConfig.PaddingChar = kyTu;
            mapping.PaddingConfig = paddingConfig;
        }

        return mapping;
    }

    private static bool? ParseNullableBoolFromExcel(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var s = input.Trim().Replace('\u00A0', ' ').Trim();
        if (s.Equals("1", StringComparison.Ordinal) ||
            s.Equals("true", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("y", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("x", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("co", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("Có", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("OK", StringComparison.OrdinalIgnoreCase))
            return true;
        if (s.Equals("0", StringComparison.Ordinal) ||
            s.Equals("false", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("no", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("n", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("khong", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("Không", StringComparison.OrdinalIgnoreCase) ||
            s.Equals("NG", StringComparison.OrdinalIgnoreCase))
            return false;
        return null;
    }

    private static string GetCellValue(IXLRow row, Dictionary<string, int> columnMap, string columnName)
    {
        if (columnMap.TryGetValue(columnName, out var colIndex))
            return CellAsInvariantText(row.Cell(colIndex));
        return "";
    }

    private static string NormalizeBackslash(string value) =>
        string.IsNullOrEmpty(value) ? value : value.Replace("\\\\", "\\", StringComparison.Ordinal);

    private static string? NormalizeCaseFormat(string? caseFormat)
    {
        if (string.IsNullOrWhiteSpace(caseFormat)) return null;
        return caseFormat.Trim().ToLowerInvariant() switch
        {
            "uppercase" => "Uppercase",
            "lowercase" => "Lowercase",
            "titlecase" => "TitleCase",
            "capitalizefirst" => "CapitalizeFirst",
            "capitalizelast" => "CapitalizeLast",
            _ => null
        };
    }

    private static object? ParseValue(string value, string type)
    {
        if (string.IsNullOrEmpty(value))
        {
            if (string.IsNullOrEmpty(type) || type.ToLowerInvariant() == "string")
                return "";
            return null;
        }

        if (string.IsNullOrEmpty(type))
            return value;

        switch (type.ToLowerInvariant())
        {
            case "string":
                return value;
            case "int":
                return int.TryParse(value, out var intVal) ? intVal : 0;
            case "bool":
                if (bool.TryParse(value, out var boolVal)) return boolVal;
                if (value.Equals("TRUE", StringComparison.OrdinalIgnoreCase)) return true;
                if (value.Equals("FALSE", StringComparison.OrdinalIgnoreCase)) return false;
                return false;
            case "array":
                return value.Split(',')
                    .Select(s => int.TryParse(s.Trim(), out var v) ? v : 0)
                    .Where(v => v > 0)
                    .ToArray();
            default:
                return value;
        }
    }
}
