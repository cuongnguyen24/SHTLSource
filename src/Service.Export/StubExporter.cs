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

            return new ExportResult
            {
                Success = true,
                Message = $"Export thành công {tables[0].Rows.Count} dòng",
                DownloadPath = filePath,
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
                    if (x is not System.Collections.IDictionary d)
                        return false;
                    var value = TryGetDictionaryValue(d, "doc_type_id") ?? TryGetDictionaryValue(d, "DocTypeId");
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
                if (x is not System.Collections.IDictionary d)
                    return false;
                var value = TryGetDictionaryValue(d, "doc_type_id") ?? TryGetDictionaryValue(d, "DocTypeId");
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
