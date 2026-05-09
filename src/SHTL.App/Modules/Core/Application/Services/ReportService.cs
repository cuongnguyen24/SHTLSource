using Dapper;
using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Core.Application.Services;

public class ProductivityReport
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int ScanCount { get; set; }
    public int ExtractCount { get; set; }
    public int Check1Count { get; set; }
    public int Check2Count { get; set; }
    public int CheckFinalCount { get; set; }
    public int ExportCount { get; set; }
    public DateTime Date { get; set; }
}

public class WorkflowProgressReport
{
    public int TotalDocuments { get; set; }
    public int AtScan { get; set; }
    public int AtCheckScan1 { get; set; }
    public int AtCheckScan2 { get; set; }
    public int AtZone { get; set; }
    public int AtOcr { get; set; }
    public int AtExtract { get; set; }
    public int AtCheck1 { get; set; }
    public int AtCheck2 { get; set; }
    public int AtCheckFinal { get; set; }
    public int AtCheckLogic { get; set; }
    public int AtExport { get; set; }
    public int Completed { get; set; }
}

public interface IReportService
{
    Task<WorkflowProgressReport> GetWorkflowProgressAsync();
    Task<IEnumerable<ProductivityReport>> GetProductivityAsync(DateTime startDate, DateTime endDate);
}

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db, ILogger<ReportService> logger)
    {
        _db = db;
        _ = logger;
    }

    public async Task<WorkflowProgressReport> GetWorkflowProgressAsync()
    {
        var conn = await _db.GetOpenConnectionAsync();
        var rows = await conn.QueryAsync<(byte step, long count)>(
            @"SELECT current_step, COUNT(1) as cnt 
              FROM dbo.stg_documents 
              WHERE status = 1
              GROUP BY current_step");

        var dict = rows.ToDictionary(r => r.step, r => (int)r.count);
        int Get(WorkflowStep s) => dict.TryGetValue((byte)s, out var v) ? v : 0;

        return new WorkflowProgressReport
        {
            TotalDocuments = dict.Values.Sum(),
            AtScan = Get(WorkflowStep.Scan),
            AtCheckScan1 = Get(WorkflowStep.CheckScan1),
            AtCheckScan2 = Get(WorkflowStep.CheckScan2),
            AtZone = Get(WorkflowStep.Zone),
            AtOcr = Get(WorkflowStep.Ocr),
            AtExtract = Get(WorkflowStep.Extract),
            AtCheck1 = Get(WorkflowStep.Check1),
            AtCheck2 = Get(WorkflowStep.Check2),
            AtCheckFinal = Get(WorkflowStep.CheckFinal),
            AtCheckLogic = Get(WorkflowStep.CheckLogic),
            AtExport = Get(WorkflowStep.Export),
            Completed = Get(WorkflowStep.Completed)
        };
    }

    public async Task<IEnumerable<ProductivityReport>> GetProductivityAsync(DateTime startDate, DateTime endDate)
    {
        var conn = await _db.GetOpenConnectionAsync();
        return await conn.QueryAsync<ProductivityReport>(@"
            SELECT
                created_by as UserId,
                COUNT(CASE WHEN current_step >= 1 THEN 1 END) as ScanCount,
                COUNT(CASE WHEN is_extracted = 1 THEN 1 END) as ExtractCount,
                COUNT(CASE WHEN is_checked1 = 1 THEN 1 END) as Check1Count,
                COUNT(CASE WHEN is_checked2 = 1 THEN 1 END) as Check2Count,
                COUNT(CASE WHEN is_checked_final = 1 THEN 1 END) as CheckFinalCount,
                COUNT(CASE WHEN export_status = 2 THEN 1 END) as ExportCount,
                CAST(created AS DATE) as Date
            FROM dbo.stg_documents
            WHERE created >= @Start AND created < @End
              AND status != 2
            GROUP BY created_by, CAST(created AS DATE)
            ORDER BY Date DESC",
            new { Start = startDate, End = endDate.AddDays(1) });
    }
}
