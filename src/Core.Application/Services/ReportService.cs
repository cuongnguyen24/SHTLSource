using Core.Domain.Enums;
using Dapper;
using Infrastructure.Data;
using Infrastructure.Data.Repositories.Stg;

namespace Core.Application.Services;

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
    public int ChannelId { get; set; }
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
    Task<WorkflowProgressReport> GetWorkflowProgressAsync(int channelId);
    Task<IEnumerable<ProductivityReport>> GetProductivityAsync(int channelId, DateTime startDate, DateTime endDate);
}

public class ReportService : IReportService
{
    private readonly IDocumentRepository _docRepo;
    private readonly IDbConnectionFactory _factory;

    public ReportService(IDocumentRepository docRepo, IDbConnectionFactory factory)
    {
        _docRepo = docRepo;
        _factory = factory;
    }

    public async Task<WorkflowProgressReport> GetWorkflowProgressAsync(int channelId)
    {
        using var conn = _factory.CreateStgConnection();
        var rows = await conn.QueryAsync<(byte step, long count)>(
            @"SELECT current_step, COUNT(1) as cnt 
              FROM core_stg.documents 
              WHERE channel_id = @ChannelId AND status = 1
              GROUP BY current_step",
            new { ChannelId = channelId });

        var dict = rows.ToDictionary(r => r.step, r => (int)r.count);
        int Get(WorkflowStep s) => dict.TryGetValue((byte)s, out var v) ? v : 0;

        return new WorkflowProgressReport
        {
            ChannelId = channelId,
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

    public async Task<IEnumerable<ProductivityReport>> GetProductivityAsync(int channelId, DateTime startDate, DateTime endDate)
    {
        using var conn = _factory.CreateStgConnection();
        return await conn.QueryAsync<ProductivityReport>(@"
            SELECT
                created_by as UserId,
                COUNT(CASE WHEN current_step >= 1 THEN 1 END) as ScanCount,
                COUNT(CASE WHEN is_extracted = true THEN 1 END) as ExtractCount,
                COUNT(CASE WHEN is_checked1 = true THEN 1 END) as Check1Count,
                COUNT(CASE WHEN is_checked2 = true THEN 1 END) as Check2Count,
                COUNT(CASE WHEN is_checked_final = true THEN 1 END) as CheckFinalCount,
                COUNT(CASE WHEN export_status = 2 THEN 1 END) as ExportCount,
                CAST(created AS DATE) as Date
            FROM core_stg.documents
            WHERE channel_id = @ChannelId
              AND created >= @Start AND created < @End
              AND status != 2
            GROUP BY created_by, CAST(created AS DATE)
            ORDER BY Date DESC",
            new { ChannelId = channelId, Start = startDate, End = endDate.AddDays(1) });
    }
}
