using System.Collections.Generic;
using System.IO.Compression;
using ClosedXML.Excel;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using SHTL.Exporting;

namespace SHTL.Service.Export;

/// <summary>Exporter tạm — thay bằng factory theo ExportType.Code khi triển khai xuất thực.</summary>
internal sealed class StubExporter : BaseExporterDemo
{
    private readonly string _connectionString;

    public StubExporter(
        ILogger<StubExporter> logger,
        IConfiguration config,
        ExportJobContext queue,
        ExportTypeContext exportType)
        : base(logger, config, queue, exportType)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
    }

    protected override async Task<ExportResult> ExecuteExportAsync()
    {
        try
        {
            _logger.LogInformation(
                "StubExporter start: job={JobId} code={Code} exportTypeId={ExportTypeId} inputDocTypes={DocTypes} defaultDocTypeIds={DefaultIds}",
                JobId,
                ExportType.Code,
                ExportType.Id,
                Input.DocTypes.Count == 0 ? "(any)" : string.Join(",", Input.DocTypes),
                Config.DefaultDocTypeIds is { Count: > 0 } ? string.Join(",", Config.DefaultDocTypeIds) : "(none)");

            var docs = await LoadDocumentsAsync().ConfigureAwait(false);
            if (docs.Count == 0)
            {
                var emptyDetail =
                    $"rawAfterSql=0 hoặc đã lọc hết | jobDocTypes={(Input.DocTypes.Count == 0 ? "none" : string.Join(",", Input.DocTypes))} | defaultDocTypeIds={(Config.DefaultDocTypeIds is { Count: > 0 } ? string.Join(",", Config.DefaultDocTypeIds) : "none")}";
                _logger.LogWarning("StubExporter: không có tài liệu sau lọc. {Detail}", emptyDetail);
                return new ExportResult
                {
                    Success = false,
                    Message = "Không có dữ liệu tài liệu phù hợp để export",
                    Total = 0,
                    Processed = 0,
                    SuccessCount = 0,
                    ErrorCount = 0,
                    Error = emptyDetail
                };
            }

            _logger.LogInformation("StubExporter: loaded {DocCount} documents before BuildExportDataTables", docs.Count);

            var tables = BuildExportDataTables(docs.Cast<object>());
            if (tables.Count == 0 || tables[0].Rows.Count == 0)
            {
                var diag = LastExportSheetEmptyDiagnostics ?? "(không tạo được diagnostics — xem log BuildExportDataTables)";
                _logger.LogWarning(
                    "StubExporter: sheet trống. docs={DocCount} diag={Diag}",
                    docs.Count,
                    diag);
                return new ExportResult
                {
                    Success = false,
                    Message = "Không tạo được dữ liệu sheet từ cấu hình export",
                    Total = docs.Count,
                    Processed = 0,
                    SuccessCount = 0,
                    ErrorCount = 0,
                    Error = diag
                };
            }

            var fileName = $"{ExportType.Code}_{JobId}.xlsx";
            var filePath = Path.Combine(TargetPath, fileName);
            SaveToExcel(filePath, tables);

            var downloadPath = filePath;
            if (Queue.IsExportFile)
            {
                var copied = CopyPhysicalFilesFromDocuments(docs, TargetPath, SourcePath);
                _logger.LogInformation(
                    "StubExporter: IsExportFile — đã copy {Copied}/{Total} file giữ cấu trúc thư mục storage vào {Dir}",
                    copied,
                    docs.Count,
                    TargetPath);

                var zipName = $"{ExportType.Code}_{Queue.Id}.zip";
                var zipFullPath = Path.Combine(SourcePath, "EXPORT", zipName);
                Directory.CreateDirectory(Path.GetDirectoryName(zipFullPath)!);
                if (File.Exists(zipFullPath))
                    File.Delete(zipFullPath);

                ZipFile.CreateFromDirectory(TargetPath, zipFullPath, CompressionLevel.Optimal, includeBaseDirectory: false);
                downloadPath = zipFullPath;
                _logger.LogInformation("StubExporter: đã tạo ZIP tải về {Zip}", zipFullPath);
            }

            return new ExportResult
            {
                Success = true,
                Message = Queue.IsExportFile
                    ? $"Export thành công {tables[0].Rows.Count} dòng (kèm file vật lý trong ZIP)"
                    : $"Export thành công {tables[0].Rows.Count} dòng",
                DownloadPath = downloadPath,
                Total = docs.Count,
                Processed = tables[0].Rows.Count,
                SuccessCount = tables[0].Rows.Count,
                ErrorCount = Math.Max(0, docs.Count - tables[0].Rows.Count)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "StubExporter.ExecuteExportAsync failed for type {Code}", ExportType.Code);
            return new ExportResult
            {
                Success = false,
                Message = "Export thất bại",
                Error = ex.ToString()
            };
        }
    }

    private async Task<List<object>> LoadDocumentsAsync()
    {
        const string sql = """
            SELECT *
            FROM dbo.stg_documents
            WHERE status <> 255
            ORDER BY id ASC
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync().ConfigureAwait(false);
        var rows = (await conn.QueryAsync(sql).ConfigureAwait(false)).Cast<object>().ToList();
        _logger.LogInformation("LoadDocuments: SQL stg_documents (status<>255) count={Count}", rows.Count);

        if (Input.DocTypes.Count > 0)
        {
            var typeIds = new HashSet<int>();
            foreach (var x in Input.DocTypes)
            {
                if (int.TryParse(x, out var id))
                    typeIds.Add(id);
            }

            if (typeIds.Count > 0)
            {
                var before = rows.Count;
                rows = rows.Where(x =>
                {
                    var value = TryGetRowString(x, "doc_type_id", "DocTypeId");
                    return int.TryParse(value, out var id) && typeIds.Contains(id);
                }).ToList();
                _logger.LogInformation(
                    "LoadDocuments: after job doctypes filter {Types} count {Before}->{After}",
                    string.Join(",", typeIds),
                    before,
                    rows.Count);
            }
        }

        if (Config.DefaultDocTypeIds is { Count: > 0 })
        {
            var allow = new HashSet<int>(Config.DefaultDocTypeIds);
            var before = rows.Count;
            rows = rows.Where(x =>
            {
                var value = TryGetRowString(x, "doc_type_id", "DocTypeId");
                return int.TryParse(value, out var id) && allow.Contains(id);
            }).ToList();
            _logger.LogInformation(
                "LoadDocuments: after DefaultDocTypeIds {Ids} count {Before}->{After}",
                string.Join(",", allow.OrderBy(x => x)),
                before,
                rows.Count);
        }

        return rows;
    }

    /// <summary>
    /// Sao chép file gốc vào <paramref name="targetRoot"/> giữ đúng cấu trúc thư mục con so với <paramref name="sourceRoot"/> (storage),
    /// ví dụ <c>CSDL_SOHOA_KBNN\Đợt 3\0001\0003\0000001.pdf</c>.
    /// </summary>
    private int CopyPhysicalFilesFromDocuments(IReadOnlyList<object> docs, string targetRoot, string sourceRoot)
    {
        var rootFull = Path.GetFullPath(sourceRoot);
        var copiedDests = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var n = 0;
        foreach (var doc in docs)
        {
            var rel = GetFieldValue(doc, "file_path")
                      ?? GetFieldValue(doc, "FilePath")
                      ?? GetFieldValue(doc, "path_original")
                      ?? GetFieldValue(doc, "PathOriginal");
            var abs = ResolveUnderSourceRoot(sourceRoot, rel);
            if (abs == null || !File.Exists(abs))
                continue;

            var absFull = Path.GetFullPath(abs);
            var relFromRoot = Path.GetRelativePath(rootFull, absFull);
            if (relFromRoot.StartsWith("..", StringComparison.Ordinal) || string.IsNullOrEmpty(relFromRoot))
                continue;

            var safeRel = SanitizeRelativePath(relFromRoot);
            var dest = Path.GetFullPath(Path.Combine(targetRoot, safeRel));
            var targetRootFull = Path.GetFullPath(targetRoot);
            if (!dest.StartsWith(targetRootFull, StringComparison.OrdinalIgnoreCase))
                continue;

            if (copiedDests.Contains(dest))
                continue;

            try
            {
                var parent = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(parent))
                    Directory.CreateDirectory(parent);
                File.Copy(absFull, dest, overwrite: false);
                copiedDests.Add(dest);
                n++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "StubExporter: không copy {Src} -> {Dest}", abs, dest);
            }
        }

        return n;
    }

    private static string SanitizeRelativePath(string relativePath)
    {
        var parts = relativePath.Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return "file";

        var segments = new List<string>(parts.Length);
        foreach (var p in parts)
        {
            if (p == "." || p == "..")
                continue;
            var s = SanitizeFileName(p);
            if (!string.IsNullOrWhiteSpace(s))
                segments.Add(s);
        }

        return segments.Count == 0 ? "file" : Path.Combine(segments.ToArray());
    }

    private static string? ResolveUnderSourceRoot(string sourceRoot, string? relativeOrAbsolute)
    {
        if (string.IsNullOrWhiteSpace(relativeOrAbsolute))
            return null;

        var t = relativeOrAbsolute.Trim().Replace('\\', '/');
        if (t.Contains("..", StringComparison.Ordinal))
            return null;

        var root = Path.GetFullPath(sourceRoot);
        string full;
        if (Path.IsPathRooted(t))
        {
            full = Path.GetFullPath(t);
        }
        else
        {
            full = Path.GetFullPath(Path.Combine(sourceRoot, t.TrimStart('/')));
        }

        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            return null;

        return full;
    }

    private static string SanitizeFileName(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        return string.IsNullOrWhiteSpace(name) ? "file" : name;
    }

    private static void SaveToExcel(string path, IEnumerable<System.Data.DataTable> tables)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var wb = new XLWorkbook();
        foreach (var t in tables)
        {
            wb.Worksheets.Add(t, string.IsNullOrWhiteSpace(t.TableName) ? "Sheet1" : t.TableName);
        }
        wb.SaveAs(path);
    }

    private static string? TryGetRowString(object row, params string[] keys)
    {
        if (row is IReadOnlyDictionary<string, object> ro)
        {
            foreach (var want in keys)
            {
                foreach (var kv in ro)
                {
                    if (string.Equals(kv.Key, want, StringComparison.OrdinalIgnoreCase))
                        return kv.Value?.ToString();
                }
            }

            return null;
        }

        if (row is System.Collections.IDictionary d)
        {
            foreach (var want in keys)
            {
                var v = TryGetDictionaryValue(d, want);
                if (v != null)
                    return v;
            }
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
}
