using Dapper;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IConstructionKpiPayrollService
{
    Task<ConstructionKpiDashboardViewModel> GetKpiDashboardAsync(DateTime fromDate, DateTime toDate, int? userId = null);
    Task<ConstructionKpiRoleConfigDto?> GetKpiRoleConfigAsync(ConstructionKpiRole role);
    Task<ApiResult> RecalculateKpiAsync(DateTime workDate, ICurrentUser currentUser, int? targetUserId = null);
    Task<ApiResult> SaveKpiConfigAsync(SaveConstructionKpiConfigRequest request, ICurrentUser currentUser);
    Task<ApiResult> DeleteKpiConfigAsync(ConstructionKpiRole role, ICurrentUser currentUser);
    Task<ConstructionPayrollDashboardViewModel> GetPayrollDashboardAsync(int year, int month, int? userId = null);
    Task<ApiResult> RecalculatePayrollAsync(int year, int month, ICurrentUser currentUser);
    Task<ApiResult> ApprovePayrollAsync(long payrollId, ICurrentUser currentUser);
}

public sealed class ConstructionKpiPayrollService : IConstructionKpiPayrollService
{
    private readonly IConstructionKpiPayrollRepository _repo;
    private readonly IUserRepository _users;
    private readonly AppDbContext _db;
    private readonly ICnfRepository _cnfRepo;

    public ConstructionKpiPayrollService(
        IConstructionKpiPayrollRepository repo,
        IUserRepository users,
        AppDbContext db,
        ICnfRepository cnfRepo)
    {
        _repo = repo;
        _users = users;
        _db = db;
        _cnfRepo = cnfRepo;
    }

    public async Task<ConstructionKpiDashboardViewModel> GetKpiDashboardAsync(DateTime fromDate, DateTime toDate, int? userId = null)
    {
        var from = fromDate.Date;
        var to = toDate.Date;
        var settings = await ConstructionKpiConfig.LoadAsync(_cnfRepo);
        var kpis = await _repo.GetDailyKpisAsync(from, to, userId);
        var enriched = EnrichKpiRows(kpis, settings);
        return new ConstructionKpiDashboardViewModel
        {
            FromDate = from,
            ToDate = to,
            Attendance = await _repo.GetAttendancesAsync(from, to, userId),
            Kpis = enriched,
            RoleConfigs = settings.Roles.Select(MapRoleConfig).ToList()
        };
    }

    public async Task<ConstructionKpiRoleConfigDto?> GetKpiRoleConfigAsync(ConstructionKpiRole role)
    {
        var settings = await ConstructionKpiConfig.LoadAsync(_cnfRepo);
        var cfg = settings.Roles.FirstOrDefault(x => x.Role == role);
        return cfg is null ? null : MapRoleConfig(cfg);
    }

    public async Task<ApiResult> SaveKpiConfigAsync(SaveConstructionKpiConfigRequest request, ICurrentUser currentUser)
    {
        var tiers = request.BonusTiers
            .Where(t => t.MinProcessed > 0 || t.BonusAmount > 0)
            .Select(t => new ConstructionKpiBonusTier
            {
                MinProcessed = t.MinProcessed,
                MinQualityPercent = t.MinQualityPercent,
                BonusAmount = t.BonusAmount
            })
            .ToList();

        await ConstructionKpiConfig.SaveRoleAsync(
            _cnfRepo,
            request.Role,
            Math.Max(1, request.DailyTarget),
            Math.Clamp(request.MinQualityPercent, 0, 100),
            tiers,
            currentUser.Id);

        return ApiResult.Ok($"Đã lưu cấu hình KPI — {ConstructionKpiConfig.DisplayName(request.Role)}.");
    }

    public async Task<ApiResult> DeleteKpiConfigAsync(ConstructionKpiRole role, ICurrentUser currentUser)
    {
        await ConstructionKpiConfig.SaveRoleAsync(
            _cnfRepo,
            role,
            1,
            0,
            Array.Empty<ConstructionKpiBonusTier>(),
            currentUser.Id);

        return ApiResult.Ok($"Đã xóa mốc thưởng và reset KPI về mặc định tối thiểu cho vai trò {ConstructionKpiConfig.DisplayName(role)}.");
    }

    public async Task<ApiResult> RecalculateKpiAsync(DateTime workDate, ICurrentUser currentUser, int? targetUserId = null)
    {
        var date = workDate.Date;
        var settings = await ConstructionKpiConfig.LoadAsync(_cnfRepo);
        var users = await _users.GetActiveUsersAsync();
        if (targetUserId.HasValue)
            users = users.Where(x => x.Id == targetUserId.Value).ToList();
        var conn = await _db.GetOpenConnectionAsync();

        foreach (var user in users)
        {
            var stepStats = new Dictionary<WorkflowStep, KpiAggRow>();

            await AggregateStepAsync(conn, user.Id, date, WorkflowStep.CheckScan1, stepStats, CheckScan1Sql);
            await AggregateStepAsync(conn, user.Id, date, WorkflowStep.CheckScan2, stepStats, CheckScan2Sql);
            await AggregateStepAsync(conn, user.Id, date, WorkflowStep.Extract, stepStats, ExtractSql);
            await AggregateStepAsync(conn, user.Id, date, WorkflowStep.Check1, stepStats, Check1Sql);

            foreach (var (step, row) in stepStats)
            {
                if (row.Total <= 0) continue;

                var role = ConstructionKpiConfig.MapWorkflowStep(step);
                var roleSettings = role.HasValue ? settings.GetRole(role.Value) : null;
                var quality = row.Total <= 0 ? 0m : Math.Round((row.Passed * 100m) / row.Total, 2);
                var bonus = roleSettings is not null
                    ? ConstructionKpiConfig.CalculateBonus(roleSettings, row.Total, quality)
                    : 0m;

                await _repo.UpsertDailyKpiAsync(new ConstructionUserDailyKpi
                {
                    UserId = user.Id,
                    WorkDate = date,
                    Step = step,
                    BatchId = null,
                    DocumentsProcessed = row.Total,
                    DocumentsPassed = row.Passed,
                    DocumentsFailed = row.Failed,
                    DocumentsReturned = row.Returned,
                    QualityScore = quality,
                    AvgMinutesPerDocument = 0,
                    WorkHours = 0,
                    Created = DateTime.UtcNow,
                    CreatedBy = currentUser.Id,
                    Updated = DateTime.UtcNow,
                    UpdatedBy = currentUser.Id
                });
            }

            if (stepStats.Count == 0) continue;

            var workDay = EvaluateWorkDay(stepStats, settings);
            await _repo.UpsertAttendanceAsync(new ConstructionAttendance
            {
                UserId = user.Id,
                WorkDate = date,
                CheckInAt = workDay ? date.AddHours(8) : null,
                CheckOutAt = workDay ? date.AddHours(17) : null,
                WorkHours = workDay ? 1m : 0m,
                Notes = workDay ? "Đủ KPI ngày" : "Chưa đủ KPI",
                Created = DateTime.UtcNow,
                CreatedBy = currentUser.Id,
                Updated = DateTime.UtcNow,
                UpdatedBy = currentUser.Id
            });
        }

        return ApiResult.Ok("Đã tính KPI và chấm công theo ngày.");
    }

    public async Task<ConstructionPayrollDashboardViewModel> GetPayrollDashboardAsync(int year, int month, int? userId = null)
    {
        return new ConstructionPayrollDashboardViewModel
        {
            Year = year,
            Month = month,
            Entries = await _repo.GetPayrollAsync(year, month, userId)
        };
    }

    public async Task<ApiResult> RecalculatePayrollAsync(int year, int month, ICurrentUser currentUser)
    {
        var first = new DateTime(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var kpis = await _repo.GetDailyKpisAsync(first, last, null);
        var settings = await ConstructionKpiConfig.LoadAsync(_cnfRepo);
        var enriched = EnrichKpiRows(kpis, settings);
        var atts = await _repo.GetAttendancesAsync(first, last, null);
        var users = await _users.GetActiveUsersAsync();
        var payrollConfig = await LoadPayrollConfigAsync();

        foreach (var user in users)
        {
            var userKpis = enriched.Where(x => x.UserId == user.Id).ToList();
            var userAtt = atts.Where(x => x.UserId == user.Id).ToList();

            var processed = userKpis.Sum(x => x.DocumentsProcessed);
            var avgQuality = userKpis.Count == 0 ? 0m : userKpis.Average(x => x.QualityScore);
            var workDays = userAtt.Sum(x => x.WorkHours);
            var kpiBonus = userKpis.Sum(x => x.BonusAmount);

            var baseSalary = payrollConfig.BaseSalary;
            var quantityAmount = processed * payrollConfig.RatePerDocument;
            var qualityBonus = avgQuality >= payrollConfig.QualityThresholdHigh
                ? payrollConfig.QualityBonusHigh
                : avgQuality >= payrollConfig.QualityThresholdMedium
                    ? payrollConfig.QualityBonusMedium
                    : 0m;
            qualityBonus += kpiBonus;

            var expectedWorkDays = CountWeekdays(year, month);
            var missingDays = Math.Max(0, expectedWorkDays - (int)workDays);
            var attendanceDeduction = missingDays > 0
                ? Math.Round(missingDays * payrollConfig.AttendanceDeductionPerDay, 0)
                : 0m;
            var total = baseSalary + quantityAmount + qualityBonus - attendanceDeduction;

            await _repo.UpsertPayrollAsync(new ConstructionPayrollEntry
            {
                UserId = user.Id,
                Year = year,
                Month = month,
                BaseSalary = baseSalary,
                QuantityAmount = quantityAmount,
                QualityBonus = qualityBonus,
                AttendanceDeduction = attendanceDeduction,
                TotalSalary = total,
                Status = ConstructionPayrollStatus.Draft,
                ApprovedAt = null,
                ApprovedBy = 0,
                Created = DateTime.UtcNow,
                CreatedBy = currentUser.Id,
                Updated = DateTime.UtcNow,
                UpdatedBy = currentUser.Id
            });
        }

        return ApiResult.Ok("Đã tính lương tháng.");
    }

    public async Task<ApiResult> ApprovePayrollAsync(long payrollId, ICurrentUser currentUser)
    {
        var conn = await _db.GetOpenConnectionAsync();
        const string sql = @"
UPDATE dbo.stg_construction_payroll_entries
SET [status] = 1,
    approved_at = SYSUTCDATETIME(),
    approved_by = @UserId,
    updated = SYSUTCDATETIME(),
    updated_by = @UserId
WHERE id = @Id;";
        var affected = await conn.ExecuteAsync(sql, new { Id = payrollId, UserId = currentUser.Id });
        return affected > 0 ? ApiResult.Ok("Đã chốt lương.") : ApiResult.Fail("Không tìm thấy phiếu lương.");
    }

    private static bool EvaluateWorkDay(Dictionary<WorkflowStep, KpiAggRow> stepStats, ConstructionKpiSettings settings)
    {
        var byRole = new Dictionary<ConstructionKpiRole, (int Processed, int Passed)>();
        foreach (var (step, row) in stepStats)
        {
            var role = ConstructionKpiConfig.MapWorkflowStep(step);
            if (!role.HasValue || row.Total <= 0) continue;
            if (!byRole.TryGetValue(role.Value, out var agg))
                agg = (0, 0);
            byRole[role.Value] = (agg.Processed + row.Total, agg.Passed + row.Passed);
        }

        foreach (var (role, agg) in byRole)
        {
            var roleSettings = settings.GetRole(role);
            var quality = agg.Processed <= 0 ? 0m : Math.Round((agg.Passed * 100m) / agg.Processed, 2);
            if (ConstructionKpiConfig.MeetsDailyKpi(roleSettings, agg.Processed, quality))
                return true;
        }

        return false;
    }

    private static List<ConstructionKpiDailyDto> EnrichKpiRows(
        IReadOnlyList<ConstructionKpiDailyDto> kpis,
        ConstructionKpiSettings settings)
    {
        var byUserDateRole = kpis
            .Where(k => ConstructionKpiConfig.MapWorkflowStep(k.Step).HasValue)
            .GroupBy(k => (k.UserId, k.WorkDate.Date, ConstructionKpiConfig.MapWorkflowStep(k.Step)!.Value))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var processed = g.Sum(x => x.DocumentsProcessed);
                    var passed = g.Sum(x => x.DocumentsPassed);
                    var quality = processed <= 0 ? 0m : Math.Round((passed * 100m) / processed, 2);
                    return (Processed: processed, Quality: quality);
                });

        var bonusAssigned = new HashSet<(int UserId, DateTime Date, ConstructionKpiRole Role)>();

        return kpis.Select(k =>
        {
            var role = ConstructionKpiConfig.MapWorkflowStep(k.Step);
            var roleSettings = role.HasValue ? settings.GetRole(role.Value) : null;
            var key = role.HasValue ? (k.UserId, k.WorkDate.Date, role.Value) : default;
            var roleAgg = role.HasValue && byUserDateRole.TryGetValue(key, out var agg)
                ? agg
                : (Processed: k.DocumentsProcessed, Quality: k.QualityScore);
            var target = roleSettings?.DailyTarget ?? 0;
            var kpiMet = roleSettings is not null &&
                         ConstructionKpiConfig.MeetsDailyKpi(roleSettings, roleAgg.Processed, roleAgg.Quality);
            decimal bonus = 0;
            if (role.HasValue && roleSettings is not null)
            {
                var bonusKey = (k.UserId, k.WorkDate.Date, role.Value);
                if (bonusAssigned.Add(bonusKey))
                    bonus = ConstructionKpiConfig.CalculateBonus(roleSettings, roleAgg.Processed, roleAgg.Quality);
            }

            return new ConstructionKpiDailyDto
            {
                UserId = k.UserId,
                UserName = k.UserName,
                FullName = k.FullName,
                WorkDate = k.WorkDate,
                Step = k.Step,
                KpiRole = role,
                StepDisplayName = GetStepDisplayName(k.Step),
                DocumentsProcessed = k.DocumentsProcessed,
                DocumentsPassed = k.DocumentsPassed,
                DocumentsFailed = k.DocumentsFailed,
                DocumentsReturned = k.DocumentsReturned,
                QualityScore = k.QualityScore,
                AvgMinutesPerDocument = k.AvgMinutesPerDocument,
                DailyTarget = target,
                KpiMet = kpiMet,
                BonusAmount = bonus
            };
        }).ToList();
    }

    private static ConstructionKpiRoleConfigDto MapRoleConfig(ConstructionKpiRoleSettings role) => new()
    {
        Role = role.Role,
        DisplayName = role.DisplayName,
        DailyTarget = role.DailyTarget,
        MinQualityPercent = role.MinQualityPercent,
        BonusTiers = role.BonusTiers.Select(t => new ConstructionKpiBonusTierDto
        {
            MinProcessed = t.MinProcessed,
            MinQualityPercent = t.MinQualityPercent,
            BonusAmount = t.BonusAmount
        }).ToList()
    };

    private static string GetStepDisplayName(WorkflowStep step) => step switch
    {
        WorkflowStep.CheckScan1 => "CheckScan (lần 1)",
        WorkflowStep.CheckScan2 => "CheckScan (lần 2)",
        WorkflowStep.Extract => "Extract",
        WorkflowStep.Check1 => "Check sau Extract",
        _ => step.ToString()
    };

    private static async Task AggregateStepAsync(
        System.Data.IDbConnection conn,
        int userId,
        DateTime workDate,
        WorkflowStep step,
        Dictionary<WorkflowStep, KpiAggRow> stats,
        string sql)
    {
        var row = await conn.QuerySingleOrDefaultAsync<KpiAggRow>(sql, new { UserId = userId, WorkDate = workDate });
        if (row is null || row.Total <= 0) return;
        stats[step] = row;
    }

    private static int CountWeekdays(int year, int month)
    {
        var first = new DateTime(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var count = 0;
        for (var d = first; d <= last; d = d.AddDays(1))
        {
            if (d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                count++;
        }
        return count;
    }

    private sealed class KpiAggRow
    {
        public int Total { get; set; }
        public int Passed { get; set; }
        public int Failed { get; set; }
        public int Returned { get; set; }
    }

    private const string CheckScan1Sql = @"
SELECT
    COUNT(1) AS Total,
    SUM(CASE WHEN d.checked_scan1result = 1 THEN 1 ELSE 0 END) AS Passed,
    SUM(CASE WHEN d.checked_scan1result = 2 THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN d.checked_scan1result = 3 THEN 1 ELSE 0 END) AS Returned
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.checked_scan1by = @UserId
  AND d.is_checked_scan1 = 1
  AND CONVERT(date, d.checked_scan1at) = @WorkDate;";

    private const string CheckScan2Sql = @"
SELECT
    COUNT(1) AS Total,
    SUM(CASE WHEN d.checked_scan2result = 1 THEN 1 ELSE 0 END) AS Passed,
    SUM(CASE WHEN d.checked_scan2result = 2 THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN d.checked_scan2result = 3 THEN 1 ELSE 0 END) AS Returned
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.checked_scan2by = @UserId
  AND d.is_checked_scan2 = 1
  AND CONVERT(date, d.checked_scan2at) = @WorkDate;";

    private const string ExtractSql = @"
SELECT
    COUNT(1) AS Total,
    SUM(CASE WHEN d.extracted_result = 1 OR d.is_extracted = 1 THEN 1 ELSE 0 END) AS Passed,
    SUM(CASE WHEN d.extracted_result = 2 THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN d.extracted_return_reason IS NOT NULL AND LTRIM(RTRIM(d.extracted_return_reason)) <> '' THEN 1 ELSE 0 END) AS Returned
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.extracted_by = @UserId
  AND d.is_extracted = 1
  AND CONVERT(date, d.extracted_at) = @WorkDate;";

    private const string Check1Sql = @"
SELECT
    COUNT(1) AS Total,
    SUM(CASE WHEN d.checked1result = 1 OR d.is_checked1 = 1 THEN 1 ELSE 0 END) AS Passed,
    SUM(CASE WHEN d.checked1result = 2 THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN d.checked1return_reason IS NOT NULL AND LTRIM(RTRIM(d.checked1return_reason)) <> '' THEN 1 ELSE 0 END) AS Returned
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.checked1by = @UserId
  AND d.is_checked1 = 1
  AND CONVERT(date, d.checked1at) = @WorkDate;";

    private async Task<ConstructionPayrollConfig> LoadPayrollConfigAsync()
    {
        var configs = await _cnfRepo.GetConfigsAsync();
        var map = configs.ToDictionary(x => x.Key ?? string.Empty, x => x.Value, StringComparer.OrdinalIgnoreCase);
        return new ConstructionPayrollConfig
        {
            BaseSalary = ReadDecimal(map, "ConstructionPayrollBaseSalary", 5_000_000m),
            RatePerDocument = ReadDecimal(map, "ConstructionPayrollRatePerDocument", 1_000m),
            QualityThresholdHigh = ReadDecimal(map, "ConstructionPayrollQualityThresholdHigh", 98m),
            QualityBonusHigh = ReadDecimal(map, "ConstructionPayrollQualityBonusHigh", 1_500_000m),
            QualityThresholdMedium = ReadDecimal(map, "ConstructionPayrollQualityThresholdMedium", 95m),
            QualityBonusMedium = ReadDecimal(map, "ConstructionPayrollQualityBonusMedium", 750_000m),
            AttendanceDeductionPerDay = ReadDecimal(map, "ConstructionPayrollAttendanceDeductionPerDay", 200_000m)
        };
    }

    private static decimal ReadDecimal(IReadOnlyDictionary<string, string?> map, string key, decimal fallback)
    {
        if (!map.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
            return fallback;
        return decimal.TryParse(raw, out var value) ? value : fallback;
    }

    private sealed class ConstructionPayrollConfig
    {
        public decimal BaseSalary { get; init; }
        public decimal RatePerDocument { get; init; }
        public decimal QualityThresholdHigh { get; init; }
        public decimal QualityBonusHigh { get; init; }
        public decimal QualityThresholdMedium { get; init; }
        public decimal QualityBonusMedium { get; init; }
        public decimal AttendanceDeductionPerDay { get; init; }
    }
}
