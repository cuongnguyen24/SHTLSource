using ClosedXML.Excel;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SHTL.Exporting;

/// <summary>Khung AXE BaseExporterDemo: fallback JSON + preload mapping Excel.</summary>
public abstract class BaseExporterDemo : BaseExporter
{
    protected Dictionary<string, Dictionary<string, string>> ExcelMappingCache { get; } = new();

    /// <summary>Khi <see cref="BuildExportDataTables"/> tạo sheet không có dòng — đọc sau gọi để gán Error/Message.</summary>
    public string? LastExportSheetEmptyDiagnostics { get; protected set; }

    protected BaseExporterDemo(
        ILogger logger,
        IConfiguration config,
        ExportJobContext queue,
        ExportTypeContext exportType)
        : base(logger, config, queue, exportType)
    {
    }

    protected override void ParseInput()
    {
        Input = new ExportInput();
        FieldFolderExport = Queue.FieldFolderExport;

        if (string.IsNullOrWhiteSpace(Queue.ExportInputJson))
            return;

        try
        {
            var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(Queue.ExportInputJson, ExportJson.DeserializeOptions)
                      ?? new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);

            Input.FieldFolder1_Field = raw.TryGetValue("FieldFolder1_Field", out var f1) ? f1.ToString() : null;
            Input.FieldFolder2_Field = raw.TryGetValue("FieldFolder2_Field", out var f2) ? f2.ToString() : null;
            Input.FieldFolder3_Field = raw.TryGetValue("FieldFolder3_Field", out var f3) ? f3.ToString() : null;
            Input.FieldFolder4_Field = raw.TryGetValue("FieldFolder4_Field", out var f4) ? f4.ToString() : null;
            Input.FieldFolder5_Field = raw.TryGetValue("FieldFolder5_Field", out var f5) ? f5.ToString() : null;
            Input.FieldFolder6_Field = raw.TryGetValue("FieldFolder6_Field", out var f6) ? f6.ToString() : null;
            Input.FieldFolder7_Field = raw.TryGetValue("FieldFolder7_Field", out var f7) ? f7.ToString() : null;
            Input.FieldFolder8_Field = raw.TryGetValue("FieldFolder8_Field", out var f8) ? f8.ToString() : null;
            Input.FieldFolder9_Field = raw.TryGetValue("FieldFolder9_Field", out var f9) ? f9.ToString() : null;
            Input.FieldFolder10_Field = raw.TryGetValue("FieldFolder10_Field", out var f10) ? f10.ToString() : null;

            Input.FieldFolders1 = ParseFieldFoldersList(raw, "fieldFolders1");
            Input.FieldFolders2 = ParseFieldFoldersList(raw, "fieldFolders2");
            Input.FieldFolders3 = ParseFieldFoldersList(raw, "fieldFolders3");
            Input.FieldFolders4 = ParseFieldFoldersList(raw, "fieldFolders4");
            Input.FieldFolders5 = ParseFieldFoldersList(raw, "fieldFolders5");
            Input.FieldFolders6 = ParseFieldFoldersList(raw, "fieldFolders6");
            Input.FieldFolders7 = ParseFieldFoldersList(raw, "fieldFolders7");
            Input.FieldFolders8 = ParseFieldFoldersList(raw, "fieldFolders8");
            Input.FieldFolders9 = ParseFieldFoldersList(raw, "fieldFolders9");
            Input.FieldFolders10 = ParseFieldFoldersList(raw, "fieldFolders10");
            Input.DocTypes = ParseDocTypesFromRaw(raw);

            if (raw.TryGetValue("thuMucGoc", out var tmg))
                Input.ThuMucGoc = tmg.ToString();
            if (raw.TryGetValue("soThuMuc", out var stm) && stm.ValueKind == JsonValueKind.Number && stm.TryGetInt32(out var stm32))
                Input.SoThuMuc = stm32;

            if (!string.IsNullOrWhiteSpace(Config.ThuMucGocConfigKey) &&
                raw.TryGetValue(Config.ThuMucGocConfigKey, out var tgc))
                Input.ThuMucGoc ??= tgc.ToString();

            if (!string.IsNullOrWhiteSpace(Config.SoThuMucConfigKey) &&
                raw.TryGetValue(Config.SoThuMucConfigKey, out var stck))
            {
                if (stck.ValueKind == JsonValueKind.Number && stck.TryGetInt32(out var stn))
                    Input.SoThuMuc ??= stn;
                else if (stck.ValueKind == JsonValueKind.String && int.TryParse(stck.GetString(), out var stp))
                    Input.SoThuMuc ??= stp;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BaseExporterDemo.ParseInput failed; fallback to empty input");
        }
    }

    protected override string? GetConfigurationJson()
    {
        var json = base.GetConfigurationJson();
        if (!string.IsNullOrEmpty(json))
            return json;

        var path = FindConfigFile(ExportType.Code);
        if (path != null && File.Exists(path))
        {
            _logger.LogInformation("Export: load JsonConfig from file {Path}", path);
            return File.ReadAllText(path);
        }

        return null;
    }

    protected virtual string? FindConfigFile(string projectName)
    {
        var serverDir = _config["Export:ConfigServerPath"];
        if (!string.IsNullOrEmpty(serverDir))
        {
            var p = Path.Combine(serverDir, $"{projectName}.json");
            if (File.Exists(p))
                return p;
        }

        var relative = _config["Export:RelativeConfigSubPath"] ?? "Config/export";
        var dir = AppContext.BaseDirectory;
        for (var depth = 0; depth < 30 && !string.IsNullOrEmpty(dir); depth++)
        {
            var c1 = Path.Combine(dir, relative, $"{projectName}.json");
            if (File.Exists(c1))
                return c1;
            var c2 = Path.Combine(dir, "Config", $"{projectName}.json");
            if (File.Exists(c2))
                return c2;
            var c3 = Path.Combine(dir, "Config", "export", $"{projectName}.json");
            if (File.Exists(c3))
                return c3;
            dir = Directory.GetParent(dir)?.FullName ?? "";
        }

        return null;
    }

    protected override void OnConfigurationLoaded() => LoadAllExcelMappingsToCache();

    protected virtual void LoadAllExcelMappingsToCache()
    {
        ExcelMappingCache.Clear();
        var loadedCount = 0;

        void fromList(IEnumerable<StaticDataMapping>? list)
        {
            if (list == null) return;
            foreach (var m in list)
            {
                if (TryPreloadTransformConfig(m.TransformConfig, out var n))
                    loadedCount += n;
            }
        }

        fromList(Config.DataMapping.CoverMappings);
        fromList(Config.DataMapping.DocumentMappings);
        fromList(Config.DataMapping.StaticMappings);
        fromList(Config.DataMapping.StaticMappings1);
        fromList(Config.DataMapping.StaticMappings2);
        fromList(Config.DataMapping.StaticMappings3);
        fromList(Config.DataMapping.StaticMappings4);
        foreach (var kv in Config.DataMapping.StaticMappingsDict)
            fromList(kv.Value);

        _logger.LogInformation("LoadAllExcelMappingsToCache: đã nạp {Count} mapping file", loadedCount);
    }

    protected virtual string GetExcelMappingCacheKey(string mappingFile, string sourceColumn, string targetColumn, bool caseSensitive) =>
        $"{mappingFile}|{sourceColumn}|{targetColumn}|{caseSensitive}";

    protected virtual bool TryPreloadTransformConfig(ValueTransformConfig? transformConfig, out int loadedCount)
    {
        loadedCount = 0;

        if (transformConfig == null || string.IsNullOrEmpty(transformConfig.MappingFile))
            return false;

        if (transformConfig.LookupMode?.Equals("Composite2Key", StringComparison.OrdinalIgnoreCase) == true)
        {
            if (string.IsNullOrEmpty(transformConfig.KeyColumn1) ||
                string.IsNullOrEmpty(transformConfig.KeyColumn2) ||
                string.IsNullOrEmpty(transformConfig.ReturnColumn))
                return false;

            var compositeKeyColumn = BuildCompositeLookupColumnKey(transformConfig.KeyColumn1, transformConfig.KeyColumn2);
            var cacheKey = GetExcelMappingCacheKey(
                transformConfig.MappingFile,
                compositeKeyColumn,
                transformConfig.ReturnColumn,
                transformConfig.CaseSensitive);

            if (ExcelMappingCache.ContainsKey(cacheKey))
                return false;

            var mappingDict = LoadExcelCompositeMappingInternal(
                transformConfig.MappingFile,
                transformConfig.KeyColumn1,
                transformConfig.KeyColumn2,
                transformConfig.ReturnColumn,
                transformConfig.CaseSensitive);

            if (mappingDict.Count > 0)
            {
                ExcelMappingCache[cacheKey] = mappingDict;
                loadedCount = 1;
                return true;
            }

            return false;
        }

        if (string.IsNullOrEmpty(transformConfig.SourceColumn) ||
            string.IsNullOrEmpty(transformConfig.TargetColumn))
            return false;

        var defaultCacheKey = GetExcelMappingCacheKey(
            transformConfig.MappingFile,
            transformConfig.SourceColumn,
            transformConfig.TargetColumn,
            transformConfig.CaseSensitive);

        if (ExcelMappingCache.ContainsKey(defaultCacheKey))
            return false;

        var dict = LoadExcelMappingInternal(
            transformConfig.MappingFile,
            transformConfig.SourceColumn,
            transformConfig.TargetColumn,
            transformConfig.CaseSensitive);

        if (dict.Count > 0)
        {
            ExcelMappingCache[defaultCacheKey] = dict;
            loadedCount = 1;
            return true;
        }

        return false;
    }

    protected virtual string BuildCompositeLookupColumnKey(string keyColumn1, string keyColumn2) =>
        $"{keyColumn1}+{keyColumn2}";

    protected virtual string BuildCompositeLookupValue(string value1, string value2, bool caseSensitive)
    {
        var v1 = value1?.Trim() ?? "";
        var v2 = value2?.Trim() ?? "";
        var composite = $"{v1}|{v2}";
        return caseSensitive ? composite : composite.ToLowerInvariant();
    }

    protected virtual Dictionary<string, string> LoadExcelCompositeMappingInternal(
        string mappingFile,
        string keyColumn1,
        string keyColumn2,
        string returnColumn,
        bool caseSensitive = false)
    {
        var cmp = caseSensitive ? StringComparer.Ordinal : StringComparer.OrdinalIgnoreCase;
        var mapping = new Dictionary<string, string>(cmp);
        var excelData = LoadExcelDataForMapping(mappingFile);
        if (excelData == null || excelData.Count == 0)
            return mapping;

        foreach (var row in excelData)
        {
            var keyValue1 = row.GetValueOrDefault(keyColumn1) ?? "";
            var keyValue2 = row.GetValueOrDefault(keyColumn2) ?? "";
            var targetValue = row.GetValueOrDefault(returnColumn) ?? "";
            if (string.IsNullOrWhiteSpace(keyValue1) || string.IsNullOrWhiteSpace(keyValue2))
                continue;

            var key = BuildCompositeLookupValue(keyValue1, keyValue2, caseSensitive);
            if (!mapping.ContainsKey(key))
                mapping[key] = targetValue;
        }

        return mapping;
    }

    protected virtual Dictionary<string, string> LoadExcelMappingInternal(
        string mappingFile,
        string sourceColumn,
        string targetColumn,
        bool caseSensitive = false)
    {
        var cmp = caseSensitive ? StringComparer.Ordinal : StringComparer.OrdinalIgnoreCase;
        var mapping = new Dictionary<string, string>(cmp);

        try
        {
            var excelData = LoadExcelDataForMapping(mappingFile);
            if (excelData == null || excelData.Count == 0)
                return mapping;

            foreach (var row in excelData)
            {
                var sourceValue = row.GetValueOrDefault(sourceColumn) ?? "";
                var targetValue = row.GetValueOrDefault(targetColumn) ?? "";
                if (string.IsNullOrEmpty(sourceValue))
                    continue;

                var key = caseSensitive ? sourceValue : sourceValue.ToLowerInvariant();
                if (!mapping.ContainsKey(key))
                    mapping[key] = targetValue;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LoadExcelMappingInternal failed for {File}", mappingFile);
        }

        return mapping;
    }

    protected virtual List<Dictionary<string, string>>? LoadExcelDataForMapping(string mappingFile)
    {
        var excelPath = ResolveMappingExcelPath(mappingFile);
        if (string.IsNullOrEmpty(excelPath) || !File.Exists(excelPath))
            return null;

        try
        {
            using var workbook = new XLWorkbook(excelPath);
            workbook.CalculateMode = XLCalculateMode.Manual;
            var ws = workbook.Worksheet(1);
            var rows = ws.RowsUsed().ToList();
            if (rows.Count == 0)
                return null;

            var keys = new List<string>();
            var data = new List<Dictionary<string, string>>();
            var iRow = 0;
            foreach (var row in rows)
            {
                iRow++;
                if (iRow == 1)
                {
                    foreach (var cell in row.CellsUsed())
                    {
                        if (cell.IsEmpty() || string.IsNullOrWhiteSpace(cell.GetString().Trim()))
                            break;
                        keys.Add(cell.GetString().Trim());
                    }
                }
                else
                {
                    var rowData = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    for (var i = 0; i < keys.Count; i++)
                    {
                        var cell = row.Cell(i + 1);
                        rowData[keys[i]] = cell.IsEmpty() ? "" : cell.GetString().Trim();
                    }
                    data.Add(rowData);
                }
            }

            return data;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LoadExcelDataForMapping failed for {File}", mappingFile);
            return null;
        }
    }

    protected virtual string? ResolveMappingExcelPath(string mappingFile)
    {
        var serverExcelDir = _config["Export:ExcelServerPath"];
        if (!string.IsNullOrEmpty(serverExcelDir))
        {
            var excelPath = Path.Combine(serverExcelDir, mappingFile);
            if (File.Exists(excelPath))
                return excelPath;
        }

        var searchRoots = new List<string>();
        var baseDir = AppContext.BaseDirectory;
        if (!string.IsNullOrEmpty(baseDir))
            searchRoots.Add(baseDir);

        var storage = _config["Storage:RootPath"] ?? _config["Storage:BasePath"];
        if (!string.IsNullOrEmpty(storage) && !searchRoots.Contains(storage, StringComparer.OrdinalIgnoreCase))
            searchRoots.Add(storage);

        foreach (var startDir in searchRoots)
        {
            var searchDir = startDir;
            for (var i = 0; i < 30 && !string.IsNullOrEmpty(searchDir); i++)
            {
                var excelPath = Path.Combine(searchDir, mappingFile);
                if (File.Exists(excelPath))
                    return excelPath;

                var fileName = Path.GetFileName(mappingFile);
                if (fileName != mappingFile && Directory.Exists(searchDir))
                {
                    try
                    {
                        foreach (var subDir in Directory.GetDirectories(searchDir))
                        {
                            var subPath = Path.Combine(subDir, fileName);
                            if (File.Exists(subPath))
                                return subPath;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogTrace(ex, "ResolveMappingExcelPath subdir scan");
                    }
                }

                searchDir = Directory.GetParent(searchDir)?.FullName ?? "";
            }
        }

        return null;
    }

    /// <summary>Load mapping từ Excel (có cache) - API public cho worker/exporter.</summary>
    public virtual Dictionary<string, string> LoadExcelMapping(
        string mappingFile,
        string sourceColumn,
        string targetColumn,
        bool caseSensitive = false)
    {
        var cacheKey = GetExcelMappingCacheKey(mappingFile, sourceColumn, targetColumn, caseSensitive);
        if (ExcelMappingCache.TryGetValue(cacheKey, out var cached))
            return cached;

        var mapping = LoadExcelMappingInternal(mappingFile, sourceColumn, targetColumn, caseSensitive);
        if (mapping.Count > 0)
            ExcelMappingCache[cacheKey] = mapping;

        return mapping;
    }

    /// <summary>Load composite mapping từ Excel (có cache).</summary>
    public virtual Dictionary<string, string> LoadExcelCompositeMapping(
        string mappingFile,
        string keyColumn1,
        string keyColumn2,
        string returnColumn,
        bool caseSensitive = false)
    {
        var compositeKey = BuildCompositeLookupColumnKey(keyColumn1, keyColumn2);
        var cacheKey = GetExcelMappingCacheKey(mappingFile, compositeKey, returnColumn, caseSensitive);
        if (ExcelMappingCache.TryGetValue(cacheKey, out var cached))
            return cached;

        var mapping = LoadExcelCompositeMappingInternal(mappingFile, keyColumn1, keyColumn2, returnColumn, caseSensitive);
        if (mapping.Count > 0)
            ExcelMappingCache[cacheKey] = mapping;

        return mapping;
    }

    /// <summary>
    /// Áp dụng ValueTransform (viết tắt/lookup) - giống AXE.
    /// Worker service hoặc exporter cụ thể gọi method này.
    /// </summary>
    public virtual string ApplyValueTransform(string value, ValueTransformConfig transformConfig, object? item = null)
    {
        if (transformConfig == null)
            return value;

        if (transformConfig.LookupMode?.Equals("Composite2Key", StringComparison.OrdinalIgnoreCase) == true)
        {
            if (item == null ||
                string.IsNullOrEmpty(transformConfig.MappingFile) ||
                string.IsNullOrEmpty(transformConfig.KeyColumn1) ||
                string.IsNullOrEmpty(transformConfig.KeyColumn2) ||
                string.IsNullOrEmpty(transformConfig.ReturnColumn) ||
                string.IsNullOrEmpty(transformConfig.KeySource1) ||
                string.IsNullOrEmpty(transformConfig.KeySource2))
                return transformConfig.DefaultValue ?? value;

            var sourceValue1 = GetFieldValue(item, transformConfig.KeySource1)?.Trim() ?? "";
            var sourceValue2 = GetFieldValue(item, transformConfig.KeySource2)?.Trim() ?? "";
            if (string.IsNullOrEmpty(sourceValue1) || string.IsNullOrEmpty(sourceValue2))
                return transformConfig.DefaultValue ?? value;

            var compositeKey = BuildCompositeLookupValue(sourceValue1, sourceValue2, transformConfig.CaseSensitive);
            var mapping = LoadExcelCompositeMapping(
                transformConfig.MappingFile,
                transformConfig.KeyColumn1,
                transformConfig.KeyColumn2,
                transformConfig.ReturnColumn,
                transformConfig.CaseSensitive);

            if (mapping.TryGetValue(compositeKey, out var result))
                return result ?? "";

            return transformConfig.DefaultValue ?? "";
        }

        if (string.IsNullOrEmpty(value))
            return value;

        if (transformConfig.ValueMappings != null && transformConfig.ValueMappings.Count > 0)
        {
            var key = transformConfig.CaseSensitive ? value : value.ToLowerInvariant();
            var mappingKey = transformConfig.ValueMappings.Keys.FirstOrDefault(k =>
                (transformConfig.CaseSensitive ? k : k.ToLowerInvariant()) == key);
            if (mappingKey != null)
                return transformConfig.ValueMappings[mappingKey];
        }

        if (!string.IsNullOrEmpty(transformConfig.MappingFile) &&
            !string.IsNullOrEmpty(transformConfig.SourceColumn) &&
            !string.IsNullOrEmpty(transformConfig.TargetColumn))
        {
            var mapping = LoadExcelMapping(
                transformConfig.MappingFile,
                transformConfig.SourceColumn,
                transformConfig.TargetColumn,
                transformConfig.CaseSensitive);

            var searchKey = transformConfig.CaseSensitive ? value : value.ToLowerInvariant();
            if (mapping.TryGetValue(searchKey, out var mappedValue))
                return mappedValue;
        }

        return !string.IsNullOrEmpty(transformConfig.DefaultValue) ? transformConfig.DefaultValue : value;
    }

    /// <summary>Chuẩn hóa tên transform kiểu AXE: bỏ (...), tham số.</summary>
    protected static string? NormalizeTransformName(string? transform)
    {
        if (string.IsNullOrWhiteSpace(transform))
            return null;
        var s = transform.Trim();
        var paren = s.IndexOf('(');
        if (paren >= 0)
            s = s[..paren].Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }

    public virtual string ApplyTransform(
        string value,
        string? transform,
        object? item = null,
        IEnumerable<object>? contextItems = null)
    {
        var fn = NormalizeTransformName(transform);
        if (string.IsNullOrEmpty(fn))
            return value;

        if (fn.Equals("Đơn giản", StringComparison.OrdinalIgnoreCase) ||
            fn.Equals("Don gian", StringComparison.OrdinalIgnoreCase))
            return value;

        if (fn.Equals("ExtractYear", StringComparison.OrdinalIgnoreCase))
            return ExtractYear(value);

        if (fn.StartsWith("ConvertDate", StringComparison.OrdinalIgnoreCase))
        {
            var format = ParseTransformArg(transform ?? "");
            return ConvertDate(value, format);
        }

        if (fn.Equals("GetFileNameWithoutExtension", StringComparison.OrdinalIgnoreCase))
            return GetFileNameWithoutExtension(item) ?? value;

        if (fn.Equals("ApplyStringFormat", StringComparison.OrdinalIgnoreCase) && item is StringFormatConfig sf)
            return ApplyStringFormat(value, sf);

        if (fn.Equals("ApplyPadding", StringComparison.OrdinalIgnoreCase) && item is PaddingConfig pf)
            return ApplyPadding(value, pf);

        if (fn.Equals("GetSoTrangVanBanTrongHoSo", StringComparison.OrdinalIgnoreCase))
            return GetSoTrangVanBanTrongHoSo(item, contextItems).ToString(CultureInfo.InvariantCulture);

        if (fn.Equals("GetSoLuongVanBanTrongHoSo", StringComparison.OrdinalIgnoreCase))
            return GetSoLuongVanBanTrongHoSo(item, contextItems, Input.DocTypes).ToString(CultureInfo.InvariantCulture);

        if (fn.Equals("GetThoiGianTaiLieuTrongHoSo", StringComparison.OrdinalIgnoreCase))
            return GetThoiGianTaiLieuTrongHoSo(item, contextItems);

        return value;
    }

    /// <summary>Thay {ColumnKey} trong pattern (vd. KBNN.{3.1}.{4}) bằng giá trị đã resolve.</summary>
    protected virtual string SubstituteColumnKeyPattern(string pattern, IReadOnlyDictionary<string, string> columnByKey)
    {
        if (string.IsNullOrEmpty(pattern) || columnByKey.Count == 0)
            return pattern;

        return Regex.Replace(pattern, @"\{([^}]+)\}", m =>
        {
            var key = m.Groups[1].Value.Trim();
            if (key.Equals("value", StringComparison.OrdinalIgnoreCase))
                return m.Value;
            return columnByKey.TryGetValue(key, out var v) ? (v ?? "") : m.Value;
        });
    }

    protected virtual string MergeFields(
        object? item,
        IEnumerable<string>? sourceFields,
        FieldMergeConfig? mergeConfig,
        IReadOnlyDictionary<string, string>? columnRing = null)
    {
        var fields = sourceFields?.Where(x => !string.IsNullOrWhiteSpace(x)).ToList() ?? new List<string>();
        if (fields.Count == 0)
        {
            if (!string.IsNullOrWhiteSpace(mergeConfig?.Pattern) && columnRing != null && columnRing.Count > 0)
                return SubstituteColumnKeyPattern(
                    mergeConfig!.Pattern!.Replace("{value}", "", StringComparison.OrdinalIgnoreCase),
                    columnRing);
            return string.Empty;
        }

        var values = new List<string>();
        foreach (var f in fields)
        {
            var v = GetFieldValue(item, f)?.Trim() ?? string.Empty;
            if (mergeConfig?.SkipEmptyFields == true && string.IsNullOrEmpty(v))
                continue;
            values.Add(v);
        }

        var sep = mergeConfig?.Separator ?? " ";
        var merged = string.Join(sep, values);
        if (!string.IsNullOrWhiteSpace(mergeConfig?.Pattern))
        {
            merged = mergeConfig!.Pattern!.Replace("{value}", merged, StringComparison.OrdinalIgnoreCase);
            if (columnRing != null && columnRing.Count > 0)
                merged = SubstituteColumnKeyPattern(merged, columnRing);
        }

        return merged;
    }

    protected virtual string ExtractYear(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        if (DateTime.TryParse(value, out var dt))
            return dt.Year.ToString(CultureInfo.InvariantCulture);

        var m = Regex.Match(value, @"\b(19|20)\d{2}\b");
        return m.Success ? m.Value : string.Empty;
    }

    protected virtual string ConvertDate(string? value, string? outputFormat = null)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        outputFormat ??= "dd/MM/yyyy";
        if (DateTime.TryParse(value, out var dt))
            return dt.ToString(outputFormat, CultureInfo.InvariantCulture);

        var known = new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "yyyyMMdd", "MM/dd/yyyy", "dd-MM-yyyy" };
        foreach (var f in known)
        {
            if (DateTime.TryParseExact(value, f, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
                return dt.ToString(outputFormat, CultureInfo.InvariantCulture);
        }
        return value;
    }

    protected virtual string ApplyStringFormat(string value, StringFormatConfig cfg)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        if (cfg == null || string.IsNullOrWhiteSpace(cfg.Case))
            return value;

        return cfg.Case.Trim().ToLowerInvariant() switch
        {
            "upper" or "uppercase" => value.ToUpperInvariant(),
            "lower" or "lowercase" => value.ToLowerInvariant(),
            "title" or "capitalize" => CultureInfo.CurrentCulture.TextInfo.ToTitleCase(value.ToLowerInvariant()),
            _ => value
        };
    }

    protected virtual string ApplyPadding(string value, PaddingConfig cfg)
    {
        if (cfg == null || cfg.TotalLength <= 0)
            return value ?? string.Empty;

        var src = value ?? string.Empty;
        var padChar = string.IsNullOrEmpty(cfg.PaddingChar) ? '0' : cfg.PaddingChar[0];
        var isRight = cfg.Position.Equals("Right", StringComparison.OrdinalIgnoreCase);
        return isRight ? src.PadRight(cfg.TotalLength, padChar) : src.PadLeft(cfg.TotalLength, padChar);
    }

    protected virtual string? GetFileNameWithoutExtension(object? item)
    {
        var fileName = GetFieldValue(item, "FileName") ?? GetFieldValue(item, "Name");
        if (string.IsNullOrWhiteSpace(fileName))
            return null;
        return Path.GetFileNameWithoutExtension(fileName);
    }

    protected virtual int GetSoTrangVanBanTrongHoSo(object? coverItem, IEnumerable<object>? contextItems)
    {
        if (contextItems == null)
            return 0;
        return contextItems.Sum(x =>
        {
            var s = GetFieldValue(x, "PageCount");
            return int.TryParse(s, out var n) ? n : 0;
        });
    }

    protected virtual int GetSoLuongVanBanTrongHoSo(object? coverItem, IEnumerable<object>? contextItems, IEnumerable<string>? docTypes)
    {
        if (contextItems == null)
            return 0;

        var typeSet = new HashSet<string>((docTypes ?? Array.Empty<string>()).Select(x => x.Trim()), StringComparer.OrdinalIgnoreCase);
        if (typeSet.Count == 0)
            return contextItems.Count();

        var count = 0;
        foreach (var x in contextItems)
        {
            var dt = GetFieldValue(x, "DocTypeId") ?? GetFieldValue(x, "IDDoctype");
            if (dt != null && typeSet.Contains(dt))
                count++;
        }
        return count;
    }

    protected virtual string GetThoiGianTaiLieuTrongHoSo(object? coverItem, IEnumerable<object>? contextItems)
    {
        if (contextItems == null)
            return string.Empty;

        var years = new List<int>();
        foreach (var x in contextItems)
        {
            var y = GetFieldValue(x, "IssuedYear");
            if (int.TryParse(y, out var y1) && y1 > 0)
            {
                years.Add(y1);
                continue;
            }

            var d = GetFieldValue(x, "Issued");
            if (DateTime.TryParse(d, out var dt))
                years.Add(dt.Year);
        }

        if (years.Count == 0)
            return string.Empty;
        var min = years.Min();
        var max = years.Max();
        return min == max ? min.ToString(CultureInfo.InvariantCulture) : $"{min}-{max}";
    }

    protected virtual List<string> ParseFieldFoldersList(
        IDictionary<string, JsonElement> raw,
        string key)
    {
        if (!raw.TryGetValue(key, out var v))
            return new List<string>();

        try
        {
            if (v.ValueKind == JsonValueKind.Array)
                return v.EnumerateArray().Select(x => x.ToString()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();

            var s = v.ToString();
            if (string.IsNullOrWhiteSpace(s))
                return new List<string>();

            if (s.StartsWith("[", StringComparison.Ordinal) && s.EndsWith("]", StringComparison.Ordinal))
                return JsonSerializer.Deserialize<List<string>>(s, ExportJson.DeserializeOptions) ?? new List<string>();

            return s.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    protected virtual List<string> ParseDocTypesFromRaw(IDictionary<string, JsonElement> raw)
    {
        return ParseFieldFoldersList(raw, "doctypes");
    }

    protected virtual string ResolveMappedValue(
        object? item,
        StaticDataMapping mapping,
        IEnumerable<object>? contextItems = null,
        IReadOnlyDictionary<string, string>? columnRing = null,
        int sttvb = 0)
    {
        string value = string.Empty;

        if (!string.IsNullOrWhiteSpace(mapping.SourceField))
        {
            value = GetFieldValue(item, mapping.SourceField!) ?? string.Empty;
        }
        else if (mapping.SourceFields != null && mapping.SourceFields.Count > 0)
        {
            value = MergeFields(item, mapping.SourceFields, mapping.MergeConfig, columnRing);
        }
        else if (mapping.MergeConfig != null && !string.IsNullOrWhiteSpace(mapping.MergeConfig.Pattern))
        {
            var p = mapping.MergeConfig.Pattern.Replace("{value}", "", StringComparison.OrdinalIgnoreCase);
            value = columnRing != null && columnRing.Count > 0
                ? SubstituteColumnKeyPattern(p, columnRing)
                : p;
        }

        if (string.IsNullOrWhiteSpace(value) && !string.IsNullOrWhiteSpace(mapping.FallbackField))
            value = GetFieldValue(item, mapping.FallbackField!) ?? string.Empty;

        if (mapping.TransformConfig != null)
            value = ApplyValueTransform(value, mapping.TransformConfig, item);

        if (!string.IsNullOrWhiteSpace(mapping.Transform))
            value = ApplyTransform(value, mapping.Transform, item, contextItems);

        if (mapping.FormatConfig != null)
            value = ApplyStringFormat(value, mapping.FormatConfig);

        if (mapping.PaddingConfig != null)
            value = ApplyPadding(value, mapping.PaddingConfig);

        var tn = NormalizeTransformName(mapping.Transform);
        if (string.Equals(tn, "GetSoThuTuVanBan", StringComparison.OrdinalIgnoreCase))
            value = sttvb.ToString(CultureInfo.InvariantCulture);

        if (string.IsNullOrWhiteSpace(value))
            value = mapping.DefaultValue ?? string.Empty;

        return value;
    }

    protected virtual IEnumerable<StaticDataMapping> GetOrderedMappingsWithColumnKeys(bool coverAndDocument)
    {
        IEnumerable<StaticDataMapping> seq = Config.DataMapping.CoverMappings;
        if (coverAndDocument)
            seq = Config.DataMapping.CoverMappings.Concat(Config.DataMapping.DocumentMappings);
        return seq
            .Where(m => !string.IsNullOrWhiteSpace(m.ColumnKey))
            .OrderBy(m => m.Order ?? int.MaxValue)
            .ThenBy(m => m.ColumnKey, StringComparer.OrdinalIgnoreCase);
    }

    protected virtual Dictionary<string, string> BuildColumnKeyRingForCover(object cover, IEnumerable<object> contextItems)
    {
        var ring = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var ordered = GetOrderedMappingsWithColumnKeys(coverAndDocument: true).ToList();
        var coverLabel = GetExportItemLogLabel(cover);
        var passesUsed = 0;
        var converged = false;

        for (var pass = 0; pass < 30; pass++)
        {
            passesUsed = pass + 1;
            var changed = false;
            foreach (var m in ordered)
            {
                var key = m.ColumnKey!.Trim();
                var v = ResolveMappedValue(cover, m, contextItems, ring, 0);
                if (!ring.TryGetValue(key, out var prev) || prev != v)
                {
                    ring[key] = v;
                    changed = true;
                }
            }

            if (!changed)
            {
                converged = true;
                break;
            }
        }

        if (!converged)
        {
            _logger.LogWarning(
                "Export cover ring: chưa hội tụ sau {MaxPasses} lượt (Cover={Cover}, ColumnKeys={KeyCount})",
                30,
                coverLabel,
                ordered.Count);
        }
        else if (passesUsed > 1)
        {
            _logger.LogDebug(
                "Export cover ring: hội tụ sau {Passes} lượt (Cover={Cover}, keys={KeyCount})",
                passesUsed,
                coverLabel,
                ring.Count);
        }

        return ring;
    }

    protected virtual Dictionary<string, string> BuildColumnKeyRingForDocument(
        object doc,
        object? cover,
        IEnumerable<object> contextItems,
        int sttvb,
        IReadOnlyDictionary<string, string> coverRing)
    {
        var ring = new Dictionary<string, string>(coverRing, StringComparer.OrdinalIgnoreCase);
        var ordered = Config.DataMapping.DocumentMappings
            .Where(m => !string.IsNullOrWhiteSpace(m.ColumnKey))
            .OrderBy(m => m.Order ?? int.MaxValue)
            .ThenBy(m => m.ColumnKey, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var docLabel = GetExportItemLogLabel(doc);
        var coverLabel = GetExportItemLogLabel(cover);
        var passesUsed = 0;
        var converged = false;

        for (var pass = 0; pass < 30; pass++)
        {
            passesUsed = pass + 1;
            var changed = false;
            foreach (var m in ordered)
            {
                var key = m.ColumnKey!.Trim();
                var v = ResolveMappedValue(doc, m, contextItems, ring, sttvb);
                if (!ring.TryGetValue(key, out var prev) || prev != v)
                {
                    ring[key] = v;
                    changed = true;
                }
            }

            if (!changed)
            {
                converged = true;
                break;
            }
        }

        if (!converged)
        {
            _logger.LogWarning(
                "Export doc ring: chưa hội tụ sau {MaxPasses} lượt (Doc={Doc}, Cover={Cover}, STTVB={Sttvb}, DocColumnKeys={KeyCount})",
                30,
                docLabel,
                coverLabel,
                sttvb,
                ordered.Count);
        }
        return ring;
    }

    private static string? ParseTransformArg(string transform)
    {
        var i1 = transform.IndexOf('(');
        var i2 = transform.LastIndexOf(')');
        if (i1 < 0 || i2 <= i1)
            return null;
        var raw = transform.Substring(i1 + 1, i2 - i1 - 1).Trim().Trim('"', '\'');
        return string.IsNullOrWhiteSpace(raw) ? null : raw;
    }

    protected virtual string GetFieldFolderSelector(int level) => level switch
    {
        1 => Input.FieldFolder1_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 1)?.FieldName ?? "Field1",
        2 => Input.FieldFolder2_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 2)?.FieldName ?? "Field2",
        3 => Input.FieldFolder3_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 3)?.FieldName ?? "Field3",
        4 => Input.FieldFolder4_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 4)?.FieldName ?? "Field4",
        5 => Input.FieldFolder5_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 5)?.FieldName ?? "Field5",
        6 => Input.FieldFolder6_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 6)?.FieldName ?? "Field6",
        7 => Input.FieldFolder7_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 7)?.FieldName ?? "Field7",
        8 => Input.FieldFolder8_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 8)?.FieldName ?? "Field8",
        9 => Input.FieldFolder9_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 9)?.FieldName ?? "Field9",
        10 => Input.FieldFolder10_Field ?? Config.FieldFolderMappings.FirstOrDefault(x => x.Level == 10)?.FieldName ?? "Field10",
        _ => "Field1"
    };

    protected virtual string GetEffectiveThuMucGoc() =>
        !string.IsNullOrWhiteSpace(Input.ThuMucGoc) ? Input.ThuMucGoc!.Trim()
        : !string.IsNullOrWhiteSpace(Config.ThuMucGoc) ? Config.ThuMucGoc!.Trim()
        : "CSDL_SOHOA";

    protected virtual int GetEffectiveSoThuMuc()
    {
        if (Input.SoThuMuc is > 0 and <= 10)
            return Input.SoThuMuc.Value;
        var n = Config.SoThuMuc;
        return n is > 0 and <= 10 ? n : 6;
    }

    /// <summary>Phân đoạn path sau ThuMucGoc (giống AXE BuildFolderStructureFromPath).</summary>
    protected virtual List<string> ParsePathValues(object? item)
    {
        if (item == null)
            return new List<string>();

        var path = GetFieldValue(item, "Path")
                   ?? GetFieldValue(item, "file_path")
                   ?? GetFieldValue(item, "FilePath");
        if (string.IsNullOrWhiteSpace(path))
            return new List<string>();

        path = path.Replace('\\', '/');
        var thuMucGoc = GetEffectiveThuMucGoc().Replace('\\', '/').Trim('/');
        var parts = path.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
        var idx = -1;
        for (var i = 0; i < parts.Length; i++)
        {
            var seg = parts[i];
            if (seg.Equals(thuMucGoc, StringComparison.OrdinalIgnoreCase))
            {
                idx = i;
                break;
            }

            if (seg.StartsWith("CSDL_SOHOA", StringComparison.OrdinalIgnoreCase))
            {
                idx = i;
                break;
            }
        }

        if (idx < 0)
            return new List<string>();

        var so = Math.Clamp(GetEffectiveSoThuMuc(), 1, 10);
        var values = new List<string>(so);
        for (var j = 1; j <= so && idx + j < parts.Length; j++)
        {
            var seg = parts[idx + j]?.Trim() ?? "";
            if (string.IsNullOrEmpty(seg))
                return new List<string>();
            values.Add(seg);
        }

        return values.Count == so ? values : new List<string>();
    }

    protected virtual List<string> ExtractFolderPathFromItem(object item)
    {
        if (Config.UsePathBasedStructure)
        {
            var fromPath = ParsePathValues(item);
            if (fromPath.Count > 0)
                return fromPath;
        }

        var values = new List<string>();
        var max = Math.Max(1, Math.Min(10, GetEffectiveSoThuMuc()));
        for (var level = 1; level <= max; level++)
        {
            var selector = GetFieldFolderSelector(level);
            var value = GetFieldValue(item, selector)?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(value))
                break;
            values.Add(value);
        }

        return values;
    }

    protected virtual Dictionary<string, object> BuildFolderStructure(IEnumerable<object> items)
    {
        var root = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var pathValues = ExtractFolderPathFromItem(item);
            if (pathValues.Count == 0)
                continue;

            var node = root;
            for (var i = 0; i < pathValues.Count; i++)
            {
                var key = pathValues[i];
                if (!node.TryGetValue(key, out var child))
                {
                    child = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                    node[key] = child;
                }

                if (i == pathValues.Count - 1)
                {
                    if (!((Dictionary<string, object>)child).TryGetValue("__items", out var leafItems))
                    {
                        leafItems = new List<object>();
                        ((Dictionary<string, object>)child)["__items"] = leafItems;
                    }

                    ((List<object>)leafItems).Add(item);
                }

                node = (Dictionary<string, object>)child;
            }
        }

        return root;
    }

    /// <summary>Key gom văn bản theo bìa (CoverMatchConfig.PathMatchLevels + FieldFolderMappings).</summary>
    protected virtual string GetCoverMatchKey(object? item)
    {
        if (item == null)
            return string.Empty;

        var cmc = Config.DataMapping.CoverMatchConfig;
        var levels = cmc?.PathMatchLevels;
        if (levels != null && levels.Count > 0 && Config.FieldFolderMappings.Count > 0)
        {
            var pathVals = ParsePathValues(item);
            var parts = new List<string>();
            foreach (var level in levels.OrderBy(x => x))
            {
                var fm = Config.FieldFolderMappings.FirstOrDefault(f => f.Level == level);
                if (fm == null)
                    continue;
                var v = GetFieldValue(item, fm.FieldName)?.Trim() ?? "";
                if (string.IsNullOrEmpty(v) && level > 0 && level <= pathVals.Count)
                    v = pathVals[level - 1] ?? "";
                parts.Add(v);
            }

            return string.Join("|", parts);
        }

        var pv = ParsePathValues(item);
        return pv.Count > 0 ? string.Join("|", pv) : (GetFieldValue(item, "id") ?? "");
    }

    protected virtual bool DocumentBelongsToCover(object doc, object cover, IEnumerable<object> leaf)
    {
        var levels = Config.DataMapping.CoverMatchConfig?.PathMatchLevels;
        if (levels == null || levels.Count == 0)
            return true;

        var kc = GetCoverMatchKey(cover);
        var kd = GetCoverMatchKey(doc);
        return string.Equals(kc, kd, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>ColumnKey dùng khi XuatFileVatLyDoiTen (đặt tên file vật lý) — mở rộng sau khi copy file.</summary>
    protected virtual string? GetPhysicalRenameColumnKey() =>
        string.IsNullOrWhiteSpace(Config.XuatFileVatLyDoiTen) ? null : Config.XuatFileVatLyDoiTen.Trim();

    protected virtual Dictionary<string, object> FilterFolderStructure(Dictionary<string, object> structure)
    {
        var filters = new Dictionary<int, HashSet<string>>
        {
            [1] = new HashSet<string>(Input.FieldFolders1, StringComparer.OrdinalIgnoreCase),
            [2] = new HashSet<string>(Input.FieldFolders2, StringComparer.OrdinalIgnoreCase),
            [3] = new HashSet<string>(Input.FieldFolders3, StringComparer.OrdinalIgnoreCase),
            [4] = new HashSet<string>(Input.FieldFolders4, StringComparer.OrdinalIgnoreCase),
            [5] = new HashSet<string>(Input.FieldFolders5, StringComparer.OrdinalIgnoreCase),
            [6] = new HashSet<string>(Input.FieldFolders6, StringComparer.OrdinalIgnoreCase),
            [7] = new HashSet<string>(Input.FieldFolders7, StringComparer.OrdinalIgnoreCase),
            [8] = new HashSet<string>(Input.FieldFolders8, StringComparer.OrdinalIgnoreCase),
            [9] = new HashSet<string>(Input.FieldFolders9, StringComparer.OrdinalIgnoreCase),
            [10] = new HashSet<string>(Input.FieldFolders10, StringComparer.OrdinalIgnoreCase)
        };

        Dictionary<string, object> Walk(Dictionary<string, object> node, int level)
        {
            var output = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in node)
            {
                if (kv.Key == "__items")
                {
                    output[kv.Key] = kv.Value;
                    continue;
                }

                if (filters.TryGetValue(level, out var set) && set.Count > 0 && !set.Contains(kv.Key))
                    continue;

                if (kv.Value is Dictionary<string, object> child)
                    output[kv.Key] = Walk(child, level + 1);
            }

            return output;
        }

        return Walk(structure, 1);
    }

    protected virtual int CountTotalDocuments(Dictionary<string, object> structure)
    {
        var total = 0;
        void Walk(Dictionary<string, object> node)
        {
            foreach (var kv in node)
            {
                if (kv.Key == "__items" && kv.Value is List<object> list)
                {
                    total += list.Count;
                    continue;
                }

                if (kv.Value is Dictionary<string, object> child)
                    Walk(child);
            }
        }
        Walk(structure);
        return total;
    }

    protected virtual IEnumerable<List<object>> EnumerateLeafDocuments(Dictionary<string, object> structure)
    {
        IEnumerable<List<object>> Walk(Dictionary<string, object> node)
        {
            foreach (var kv in node)
            {
                if (kv.Key == "__items" && kv.Value is List<object> list)
                    yield return list;
                else if (kv.Value is Dictionary<string, object> child)
                {
                    foreach (var x in Walk(child))
                        yield return x;
                }
            }
        }

        return Walk(structure);
    }

    /// <summary>Nhãn ngắn cho log (id, doc_type, tên file) — không log toàn bộ object.</summary>
    protected virtual string GetExportItemLogLabel(object? item)
    {
        if (item == null)
            return "(null)";

        var id = GetFieldValue(item, "id") ?? GetFieldValue(item, "Id");
        var dt = GetFieldValue(item, "doc_type_id") ?? GetFieldValue(item, "DocTypeId");
        var name = GetFieldValue(item, "file_name")
                   ?? GetFieldValue(item, "FileName")
                   ?? GetFieldValue(item, "Name");
        name = string.IsNullOrEmpty(name) ? "" : Path.GetFileName(name.Replace('\\', '/'));
        var core = $"id={id ?? "?"} docType={dt ?? "?"} file={name}";
        return core.Length > 220 ? core[..217] + "..." : core;
    }

    /// <summary>Gợi ý cấp thư mục (field hoặc path-based) để gắn vào log theo leaf.</summary>
    protected virtual string GetLeafFolderHint(IReadOnlyList<object> leaf)
    {
        if (leaf.Count == 0)
            return "";
        var parts = ExtractFolderPathFromItem(leaf[0]);
        return parts.Count > 0 ? string.Join("/", parts) : "";
    }

    protected virtual string FormatCoverMatchKeyForLog(string key) =>
        string.IsNullOrEmpty(key) ? "(empty)" : (key.Length > 160 ? key[..157] + "..." : key);

    protected virtual bool IsCoverDocument(object item)
    {
        if (Config.DefaultIDBia.HasValue)
        {
            var dt = GetFieldValue(item, "DocTypeId") ?? GetFieldValue(item, "doc_type_id");
            if (int.TryParse(dt, out var docTypeId) && docTypeId == Config.DefaultIDBia.Value)
                return true;
        }

        var cfg = Config.DataMapping.CoverMatchConfig;
        if (cfg == null || string.IsNullOrWhiteSpace(cfg.FileName))
            return false;

        var want = cfg.FileName.Trim();
        var name = GetFieldValue(item, "FileName")
                   ?? GetFieldValue(item, "file_name")
                   ?? GetFieldValue(item, "Name")
                   ?? "";
        name = Path.GetFileName(name.Replace('\\', '/'));
        if (name.Equals(want, StringComparison.OrdinalIgnoreCase))
            return true;
        if (want.StartsWith("*", StringComparison.Ordinal) &&
            name.EndsWith(want.TrimStart('*').Trim(), StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    protected virtual bool IsMucLucDocument(object item)
    {
        var dt = GetFieldValue(item, "DocTypeId");
        if (!int.TryParse(dt, out var docTypeId))
            return false;
        return Config.DefaultIDMucLuc.HasValue && docTypeId == Config.DefaultIDMucLuc.Value;
    }

    protected virtual bool IsOther1Document(object item)
    {
        var dt = GetFieldValue(item, "DocTypeId");
        if (!int.TryParse(dt, out var docTypeId))
            return false;
        return Config.DefaultIDOther1.HasValue && docTypeId == Config.DefaultIDOther1.Value;
    }

    protected virtual Dictionary<string, string> MapDataToColumnsForCover(
        object cover,
        IEnumerable<object> contextItems,
        IReadOnlyDictionary<string, string> coverRing)
    {
        var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var m in Config.DataMapping.CoverMappings.OrderBy(x => x.Order ?? int.MaxValue))
        {
            if (m.Hide || string.IsNullOrWhiteSpace(m.ColumnTitle))
                continue;
            var key = m.ColumnKey?.Trim();
            row[m.ColumnTitle] = !string.IsNullOrEmpty(key) && coverRing.TryGetValue(key, out var rv)
                ? rv
                : ResolveMappedValue(cover, m, contextItems, coverRing, 0);
        }

        foreach (var m in Config.DataMapping.DocumentMappings.OrderBy(x => x.Order ?? int.MaxValue))
        {
            if (m.Hide || string.IsNullOrWhiteSpace(m.ColumnTitle))
                continue;
            if ((m.IsShowInfoBia ?? true) == false)
            {
                row.TryAdd(m.ColumnTitle, string.Empty);
                continue;
            }

            var key = m.ColumnKey?.Trim();
            if (!string.IsNullOrEmpty(key) && coverRing.TryGetValue(key, out var rv))
                row[m.ColumnTitle] = rv;
            else if (m.SourceField?.Equals("Path", StringComparison.OrdinalIgnoreCase) == true)
                row[m.ColumnTitle] = GetFieldValue(cover, "Path")
                                      ?? GetFieldValue(cover, "file_path")
                                      ?? string.Empty;
            else
                row.TryAdd(m.ColumnTitle, string.Empty);
        }

        return row;
    }

    protected virtual Dictionary<string, string> MapDataToColumnsForDocument(
        object doc,
        object? cover,
        IEnumerable<object> contextItems,
        int sttvb,
        IReadOnlyDictionary<string, string> docRing)
    {
        var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var m in Config.DataMapping.CoverMappings.OrderBy(x => x.Order ?? int.MaxValue))
        {
            if (m.Hide || string.IsNullOrWhiteSpace(m.ColumnTitle))
                continue;
            var key = m.ColumnKey?.Trim();
            row[m.ColumnTitle] = !string.IsNullOrEmpty(key) && docRing.TryGetValue(key, out var rv)
                ? rv
                : (cover == null
                    ? string.Empty
                    : ResolveMappedValue(cover, m, contextItems, docRing, 0));
        }

        foreach (var m in Config.DataMapping.DocumentMappings.OrderBy(x => x.Order ?? int.MaxValue))
        {
            if (m.Hide || string.IsNullOrWhiteSpace(m.ColumnTitle))
                continue;

            if (IsMucLucDocument(doc) && (m.IsShowInfoMucLuc ?? true) == false)
            {
                row[m.ColumnTitle] = string.Empty;
                continue;
            }

            if (IsOther1Document(doc) && (m.IsShowInfoOther1 ?? true) == false)
            {
                row[m.ColumnTitle] = string.Empty;
                continue;
            }

            if (IsCoverDocument(doc) && (m.IsShowInfoBia ?? true) == false)
            {
                row[m.ColumnTitle] = string.Empty;
                continue;
            }

            var dk = m.ColumnKey?.Trim();
            row[m.ColumnTitle] = !string.IsNullOrEmpty(dk) && docRing.TryGetValue(dk, out var rv)
                ? rv
                : ResolveMappedValue(doc, m, contextItems, docRing, sttvb);
        }

        return row;
    }

    protected virtual List<string> BuildExportColumns()
    {
        var useSplit = Config.DataMapping.CoverMappings.Count > 0 && Config.DataMapping.DocumentMappings.Count > 0;
        if (useSplit)
        {
            return Config.DataMapping.CoverMappings
                .Concat(Config.DataMapping.DocumentMappings)
                .Where(m => !m.Hide && !string.IsNullOrWhiteSpace(m.ColumnTitle))
                .OrderBy(m => m.Order ?? int.MaxValue)
                .Select(m => m.ColumnTitle!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        return Config.DataMapping.StaticMappings
            .Where(m => !m.Hide && !string.IsNullOrWhiteSpace(m.ColumnTitle))
            .OrderBy(m => m.Order ?? int.MaxValue)
            .Select(m => m.ColumnTitle!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    protected virtual DataTable CreateExportTable(IEnumerable<string> columns, string tableName = "Sheet1")
    {
        var dt = new DataTable(tableName);
        dt.Columns.Add("STT", typeof(string));
        foreach (var c in columns)
        {
            if (!dt.Columns.Contains(c))
                dt.Columns.Add(c, typeof(string));
        }
        return dt;
    }

    protected virtual void AppendRow(DataTable table, int stt, IReadOnlyDictionary<string, string> data)
    {
        var row = table.NewRow();
        row["STT"] = stt.ToString(CultureInfo.InvariantCulture);
        foreach (DataColumn c in table.Columns)
        {
            if (c.ColumnName == "STT")
                continue;
            row[c.ColumnName] = data.TryGetValue(c.ColumnName, out var v) ? v ?? string.Empty : string.Empty;
        }
        table.Rows.Add(row);
    }

    /// <summary>Đếm doc có ít nhất một cấp thư mục (field hoặc path) để gom leaf.</summary>
    protected virtual (int WithPath, int EmptyPath, string? SampleEmptyLabel) SummarizeFolderPathResolution(
        IReadOnlyList<object> items)
    {
        var with = 0;
        var empty = 0;
        string? sample = null;
        foreach (var item in items)
        {
            var p = ExtractFolderPathFromItem(item);
            if (p.Count > 0)
            {
                with++;
                continue;
            }

            empty++;
            if (sample != null)
                continue;
            var fp = GetFieldValue(item, "file_path") ?? GetFieldValue(item, "FilePath") ?? GetFieldValue(item, "Path");
            sample = $"{GetExportItemLogLabel(item)} pathLen={(fp?.Length ?? 0)}";
        }

        return (with, empty, sample);
    }

    protected virtual string SummarizeActiveFieldFolderFilters()
    {
        var parts = new List<string>();
        void one(int level, List<string> list, string name)
        {
            if (list.Count > 0)
                parts.Add($"{name}:{list.Count}");
        }

        one(1, Input.FieldFolders1, "L1");
        one(2, Input.FieldFolders2, "L2");
        one(3, Input.FieldFolders3, "L3");
        one(4, Input.FieldFolders4, "L4");
        one(5, Input.FieldFolders5, "L5");
        one(6, Input.FieldFolders6, "L6");
        one(7, Input.FieldFolders7, "L7");
        one(8, Input.FieldFolders8, "L8");
        one(9, Input.FieldFolders9, "L9");
        one(10, Input.FieldFolders10, "L10");
        return parts.Count == 0 ? "none" : string.Join(",", parts);
    }

    protected virtual string BuildEmptySheetDiagnosticLine(
        int inputDocs,
        int columnCount,
        int rawLeaves,
        int rawLeavesNonEmpty,
        int filteredLeaves,
        int filteredLeavesNonEmpty,
        int docsWithFolderPath,
        int docsEmptyFolderPath,
        string? sampleEmpty,
        string filterSummary,
        int leafLoopIterations,
        bool useSplitColumns)
    {
        return string.Join(" | ",
            $"inputDocs={inputDocs}",
            $"useSplitColumns={useSplitColumns}",
            $"coverMaps={Config.DataMapping.CoverMappings.Count}",
            $"docMaps={Config.DataMapping.DocumentMappings.Count}",
            $"staticMaps={Config.DataMapping.StaticMappings.Count}",
            $"dataColumns={columnCount}",
            $"leavesRaw={rawLeaves}",
            $"leavesRawNonEmpty={rawLeavesNonEmpty}",
            $"leavesFiltered={filteredLeaves}",
            $"leavesFilteredNonEmpty={filteredLeavesNonEmpty}",
            $"docsWithFolderPath={docsWithFolderPath}",
            $"docsEmptyFolderPath={docsEmptyFolderPath}",
            $"sampleNoFolder={sampleEmpty ?? "-"}",
            $"fieldFolderFilters={filterSummary}",
            $"soThuMuc={GetEffectiveSoThuMuc()}",
            $"thuMucGoc={GetEffectiveThuMucGoc()}",
            $"usePathStructure={Config.UsePathBasedStructure}",
            $"leafLoops={leafLoopIterations}",
            $"defaultIDBia={Config.DefaultIDBia}",
            $"coverFile={Config.DataMapping.CoverMatchConfig?.FileName ?? "-"}");
    }

    protected virtual List<DataTable> BuildExportDataTables(IEnumerable<object> allItems)
    {
        LastExportSheetEmptyDiagnostics = null;
        var itemsList = allItems as IReadOnlyList<object> ?? allItems.ToList();
        var useSplitColumns = Config.DataMapping.CoverMappings.Count > 0 && Config.DataMapping.DocumentMappings.Count > 0;

        _logger.LogInformation(
            "BuildExportDataTables start: docs={DocCount} job={JobId} type={ExportType} useSplit={UseSplit} coverMaps={CM} docMaps={DM} staticMaps={SM} soThuMuc={So} thuMucGoc={Tmg} usePathStructure={UsePath}",
            itemsList.Count,
            JobId,
            ExportType.Code,
            useSplitColumns,
            Config.DataMapping.CoverMappings.Count,
            Config.DataMapping.DocumentMappings.Count,
            Config.DataMapping.StaticMappings.Count,
            GetEffectiveSoThuMuc(),
            GetEffectiveThuMucGoc(),
            Config.UsePathBasedStructure);

        var structure = BuildFolderStructure(itemsList);
        var rawLeaves = EnumerateLeafDocuments(structure).ToList();
        var rawNonEmptyLeaves = rawLeaves.Where(l => l.Count > 0).ToList();
        var (docsWithPath, docsEmptyPath, sampleEmpty) = SummarizeFolderPathResolution(itemsList);

        var filtered = FilterFolderStructure(structure);
        var filteredLeaves = EnumerateLeafDocuments(filtered).ToList();
        var filteredNonEmptyLeaves = filteredLeaves.Where(l => l.Count > 0).ToList();
        var filterSummary = SummarizeActiveFieldFolderFilters();

        _logger.LogInformation(
            "BuildExportDataTables structure: leavesRaw={Raw} leavesRawNonEmpty={RawN} leavesFiltered={Fil} leavesFilteredNonEmpty={FilN} docsWithFolderPath={WP} docsEmptyFolderPath={EP} fieldFolderFilters={Filters} sampleNoFolder={Sample}",
            rawLeaves.Count,
            rawNonEmptyLeaves.Count,
            filteredLeaves.Count,
            filteredNonEmptyLeaves.Count,
            docsWithPath,
            docsEmptyPath,
            filterSummary,
            sampleEmpty ?? "-");

        var columns = BuildExportColumns();
        if (columns.Count == 0)
        {
            _logger.LogWarning(
                "BuildExportDataTables: không có cột dữ liệu (chỉ STT). useSplit={UseSplit} — kiểm tra CoverMappings+DocumentMappings hoặc StaticMappings có ColumnTitle.",
                useSplitColumns);
        }

        _logger.LogInformation("BuildExportDataTables: số cột dữ liệu (không tính STT)={ColCount}", columns.Count);

        var sheet = CreateExportTable(columns, ExportType.Code);

        var stt = 0;
        var leafIndex = 0;
        foreach (var leaf in EnumerateLeafDocuments(filtered))
        {
            leafIndex++;
            if (leaf.Count == 0)
                continue;

            var leafHint = GetLeafFolderHint(leaf);
            var pathMatchLevels = Config.DataMapping.CoverMatchConfig?.PathMatchLevels;

            try
            {
                var covers = leaf.Where(IsCoverDocument).ToList();
                var mucLuc = leaf.Where(IsMucLucDocument).ToList();
                var other1 = leaf.Where(IsOther1Document).ToList();
                var regular = leaf.Where(x => !IsCoverDocument(x) && !IsMucLucDocument(x) && !IsOther1Document(x)).ToList();
                var docRowsTotal = mucLuc.Count + other1.Count + regular.Count;

                var multiCover = covers.Count > 1 && pathMatchLevels != null && pathMatchLevels.Count > 0;

                _logger.LogInformation(
                    "Export leaf #{LeafIndex}: folder={FolderHint} items={ItemCount} covers={CoverCount} mucLuc={MucLuc} other1={Other1} regular={Regular} docRows={DocRows} multiCover={MultiCover} pathLevels={PathLevelCount} usePathStructure={UsePath} job={JobId} type={ExportType}",
                    leafIndex,
                    string.IsNullOrEmpty(leafHint) ? "(no folder hint)" : leafHint,
                    leaf.Count,
                    covers.Count,
                    mucLuc.Count,
                    other1.Count,
                    regular.Count,
                    docRowsTotal,
                    multiCover,
                    pathMatchLevels?.Count ?? 0,
                    Config.UsePathBasedStructure,
                    JobId,
                    ExportType.Code);

                if (Config.DataMapping.CoverMappings.Count > 0 && covers.Count == 0)
                {
                    _logger.LogWarning(
                        "Export leaf #{LeafIndex}: có CoverMappings nhưng không tìm thấy bìa (DefaultIDBia={DefaultIDBia}, CoverFile={CoverFile}). folder={FolderHint} job={JobId}",
                        leafIndex,
                        Config.DefaultIDBia,
                        Config.DataMapping.CoverMatchConfig?.FileName,
                        leafHint,
                        JobId);
                }

                if (covers.Count > 1 && (pathMatchLevels == null || pathMatchLevels.Count == 0))
                {
                    _logger.LogWarning(
                        "Export leaf #{LeafIndex}: nhiều bìa ({CoverCount}) nhưng không cấu hình PathMatchLevels — gom theo một bìa đầu. folder={FolderHint} job={JobId}",
                        leafIndex,
                        covers.Count,
                        leafHint,
                        JobId);
                }

                if (!multiCover)
                {
                    var firstCover = covers.FirstOrDefault();
                    if (firstCover != null)
                    {
                        _logger.LogDebug(
                            "Export leaf #{LeafIndex} single-cover: coverKey={CoverKey} cover={Cover}",
                            leafIndex,
                            FormatCoverMatchKeyForLog(GetCoverMatchKey(firstCover)),
                            GetExportItemLogLabel(firstCover));
                    }

                    IReadOnlyDictionary<string, string> coverRing = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    if (firstCover != null && Config.DataMapping.CoverMappings.Count > 0)
                    {
                        coverRing = BuildColumnKeyRingForCover(firstCover, leaf);
                        stt++;
                        var rowCover = MapDataToColumnsForCover(firstCover, leaf, coverRing);
                        AppendRow(sheet, stt, rowCover);
                        _logger.LogDebug(
                            "Export leaf #{LeafIndex}: dòng bìa STT={Stt} ringKeys={RingCount}",
                            leafIndex,
                            stt,
                            coverRing.Count);
                    }

                    var sttvb = 0;
                    foreach (var doc in mucLuc.Concat(other1).Concat(regular))
                    {
                        stt++;
                        sttvb++;
                        var docRing = BuildColumnKeyRingForDocument(doc, firstCover, leaf, sttvb, coverRing);
                        var rowDoc = MapDataToColumnsForDocument(doc, firstCover, leaf, sttvb, docRing);
                        AppendRow(sheet, stt, rowDoc);
                    }

                    continue;
                }

                var assigned = new HashSet<object>(ReferenceEqualityComparer.Instance);
                var coverOrdinal = 0;
                foreach (var cover in covers)
                {
                    coverOrdinal++;
                    var coverKey = FormatCoverMatchKeyForLog(GetCoverMatchKey(cover));
                    var coverRing = BuildColumnKeyRingForCover(cover, leaf);
                    if (Config.DataMapping.CoverMappings.Count > 0)
                    {
                        stt++;
                        var rowCover = MapDataToColumnsForCover(cover, leaf, coverRing);
                        AppendRow(sheet, stt, rowCover);
                        _logger.LogInformation(
                            "Export leaf #{LeafIndex} multi-cover #{CoverOrdinal}/{CoverTotal}: dòng bìa STT={Stt} coverKey={CoverKey} cover={Cover} ringKeys={RingCount}",
                            leafIndex,
                            coverOrdinal,
                            covers.Count,
                            stt,
                            coverKey,
                            GetExportItemLogLabel(cover),
                            coverRing.Count);
                    }

                    var sttvb = 0;
                    var docsForCover = mucLuc.Concat(other1).Concat(regular)
                        .Where(d => DocumentBelongsToCover(d, cover, leaf))
                        .ToList();

                    var skippedDup = 0;
                    foreach (var doc in docsForCover)
                    {
                        if (!assigned.Add(doc))
                        {
                            skippedDup++;
                            _logger.LogDebug(
                                "Export leaf #{LeafIndex}: bỏ qua doc đã gán bìa khác (trùng match) doc={Doc} coverKey={CoverKey}",
                                leafIndex,
                                GetExportItemLogLabel(doc),
                                coverKey);
                            continue;
                        }

                        stt++;
                        sttvb++;
                        var docRing = BuildColumnKeyRingForDocument(doc, cover, leaf, sttvb, coverRing);
                        var rowDoc = MapDataToColumnsForDocument(doc, cover, leaf, sttvb, docRing);
                        AppendRow(sheet, stt, rowDoc);
                    }

                    if (skippedDup > 0)
                    {
                        _logger.LogInformation(
                            "Export leaf #{LeafIndex} cover #{CoverOrdinal}: doc khớp nhưng đã xuất dưới bìa trước — bỏ qua {Skipped} dòng trùng",
                            leafIndex,
                            coverOrdinal,
                            skippedDup);
                    }

                    _logger.LogDebug(
                        "Export leaf #{LeafIndex} cover #{CoverOrdinal}: docsKhớp={MatchedCount} (sau khi loại trùng đã gán)",
                        leafIndex,
                        coverOrdinal,
                        docsForCover.Count - skippedDup);
                }

                var fallbackCover = covers[0];
                var fbRing = BuildColumnKeyRingForCover(fallbackCover, leaf);
                var sttvbOrphan = 0;
                var orphanCount = 0;
                foreach (var doc in mucLuc.Concat(other1).Concat(regular))
                {
                    if (assigned.Contains(doc))
                        continue;
                    stt++;
                    sttvbOrphan++;
                    orphanCount++;
                    var docRing = BuildColumnKeyRingForDocument(doc, fallbackCover, leaf, sttvbOrphan, fbRing);
                    var rowDoc = MapDataToColumnsForDocument(doc, fallbackCover, leaf, sttvbOrphan, docRing);
                    AppendRow(sheet, stt, rowDoc);
                    _logger.LogDebug(
                        "Export leaf #{LeafIndex} orphan: STT={Stt} doc={Doc} (fallback bìa đầu)",
                        leafIndex,
                        stt,
                        GetExportItemLogLabel(doc));
                }

                if (orphanCount > 0)
                {
                    _logger.LogWarning(
                        "Export leaf #{LeafIndex}: {OrphanCount} văn bản không khớp bìa nào (CoverMatchKey) — xuất dưới bìa fallback {Fallback}. folder={FolderHint} job={JobId}",
                        leafIndex,
                        orphanCount,
                        GetExportItemLogLabel(fallbackCover),
                        leafHint,
                        JobId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "BuildExportDataTables: lỗi tại leaf #{LeafIndex} folder={FolderHint} items={ItemCount} pathLevels={PathLevelCount} job={JobId} exportType={ExportType}",
                    leafIndex,
                    string.IsNullOrEmpty(leafHint) ? "(unknown)" : leafHint,
                    leaf.Count,
                    pathMatchLevels?.Count ?? 0,
                    JobId,
                    ExportType.Code);
                throw;
            }
        }

        if (sheet.Rows.Count == 0)
        {
            LastExportSheetEmptyDiagnostics = BuildEmptySheetDiagnosticLine(
                itemsList.Count,
                columns.Count,
                rawLeaves.Count,
                rawNonEmptyLeaves.Count,
                filteredLeaves.Count,
                filteredNonEmptyLeaves.Count,
                docsWithPath,
                docsEmptyPath,
                sampleEmpty,
                filterSummary,
                leafIndex,
                useSplitColumns);
            _logger.LogWarning(
                "BuildExportDataTables: sheet có 0 dòng. {Diagnostics}",
                LastExportSheetEmptyDiagnostics);
        }
        else
        {
            _logger.LogInformation(
                "BuildExportDataTables done: rows={Rows} leavesProcessed={Leaves} job={JobId} type={ExportType}",
                sheet.Rows.Count,
                leafIndex,
                JobId,
                ExportType.Code);
        }

        return new List<DataTable> { sheet };
    }

    /// <summary>Helper: lấy field value từ object (reflection).</summary>
    protected new virtual string? GetFieldValue(object? item, string? fieldName)
    {
        if (item == null || string.IsNullOrEmpty(fieldName))
            return null;

        try
        {
            // DapperRow: IReadOnlyDictionary<string,object> — không triển khai System.Collections.IDictionary
            if (item is IReadOnlyDictionary<string, object> roDict)
            {
                var v = TryGetStringKeyedDictionaryValue(roDict, fieldName)
                        ?? TryGetStringKeyedDictionaryValue(roDict, ToSnakeCase(fieldName));
                if (v != null)
                    return v;
            }

            if (item is System.Collections.IDictionary dict)
            {
                var direct = TryGetDictionaryValue(dict, fieldName);
                if (direct != null)
                    return direct;

                var snake = ToSnakeCase(fieldName);
                var bySnake = TryGetDictionaryValue(dict, snake);
                if (bySnake != null)
                    return bySnake;
            }

            var prop = item.GetType().GetProperty(
                fieldName,
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.IgnoreCase);
            return prop?.GetValue(item)?.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static string? TryGetStringKeyedDictionaryValue(IReadOnlyDictionary<string, object> dict, string key)
    {
        foreach (var kv in dict)
        {
            if (string.Equals(kv.Key, key, StringComparison.OrdinalIgnoreCase))
                return kv.Value?.ToString();
        }

        return null;
    }

    private static string? TryGetDictionaryValue(System.Collections.IDictionary dict, string key)
    {
        foreach (var k in dict.Keys)
        {
            if (k == null)
                continue;
            if (string.Equals(k.ToString(), key, StringComparison.OrdinalIgnoreCase))
                return dict[k]?.ToString();
        }
        return null;
    }

    private static string ToSnakeCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value;

        var chars = new List<char>(value.Length + 8);
        for (var i = 0; i < value.Length; i++)
        {
            var c = value[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && value[i - 1] != '_')
                    chars.Add('_');
                chars.Add(char.ToLowerInvariant(c));
            }
            else
            {
                chars.Add(c);
            }
        }
        return new string(chars.ToArray());
    }
}
