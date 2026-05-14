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
    Task<ApiResult> CheckInAsync(ICurrentUser currentUser, DateTime? at = null, string? notes = null);
    Task<ApiResult> CheckOutAsync(ICurrentUser currentUser, DateTime? at = null, string? notes = null);
    Task<ConstructionKpiDashboardViewModel> GetKpiDashboardAsync(DateTime fromDate, DateTime toDate, int? userId = null);
    Task<ApiResult> RecalculateKpiAsync(DateTime workDate, ICurrentUser currentUser);
    Task<ConstructionPayrollDashboardViewModel> GetPayrollDashboardAsync(int year, int month, int? userId = null);
    Task<ApiResult> RecalculatePayrollAsync(int year, int month, ICurrentUser currentUser);
    Task<ApiResult> ApprovePayrollAsync(long payrollId, ICurrentUser currentUser);
}

public sealed class ConstructionKpiPayrollService : IConstructionKpiPayrollService
{
    private readonly IConstructionKpiPayrollRepository _repo;
    private readonly IConstructionBatchRepository _batchRepo;
    private readonly IUserRepository _users;
    private readonly AppDbContext _db;
    private readonly ICnfRepository _cnfRepo;

    public ConstructionKpiPayrollService(
        IConstructionKpiPayrollRepository repo,
        IConstructionBatchRepository batchRepo,
        IUserRepository users,
        AppDbContext db,
        ICnfRepository cnfRepo)
    {
        _repo = repo;
        _batchRepo = batchRepo;
        _users = users;
        _db = db;
        _cnfRepo = cnfRepo;
    }

    public async Task<ApiResult> CheckInAsync(ICurrentUser currentUser, DateTime? at = null, string? notes = null)
    {
        var now = at?.ToUniversalTime() ?? DateTime.UtcNow;
        var row = new ConstructionAttendance
        {
            UserId = currentUser.Id,
            WorkDate = now.Date,
            CheckInAt = now,
            CheckOutAt = null,
            WorkHours = 0,
            Notes = notes,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id,
            Updated = DateTime.UtcNow,
            UpdatedBy = currentUser.Id
        };
        await _repo.UpsertAttendanceAsync(row);
        return ApiResult.Ok("Đã chấm công vào.");
    }

    public async Task<ApiResult> CheckOutAsync(ICurrentUser currentUser, DateTime? at = null, string? notes = null)
    {
        var now = at?.ToUniversalTime() ?? DateTime.UtcNow;
        var today = await _repo.GetAttendancesAsync(now.Date, now.Date, currentUser.Id);
        var att = today.FirstOrDefault();
        if (att is null)
        {
            return await CheckInAsync(currentUser, now, notes);
        }

        var checkIn = now.Date.AddHours(8);
        var hours = Math.Max(0m, (decimal)(now - checkIn).TotalHours);
        var row = new ConstructionAttendance
        {
            UserId = currentUser.Id,
            WorkDate = now.Date,
            CheckInAt = checkIn,
            CheckOutAt = now,
            WorkHours = Math.Round(hours, 2),
            Notes = notes,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id,
            Updated = DateTime.UtcNow,
            UpdatedBy = currentUser.Id
        };
        await _repo.UpsertAttendanceAsync(row);
        return ApiResult.Ok("Đã chấm công ra.");
    }

    public async Task<ConstructionKpiDashboardViewModel> GetKpiDashboardAsync(DateTime fromDate, DateTime toDate, int? userId = null)
    {
        var from = fromDate.Date;
        var to = toDate.Date;
        return new ConstructionKpiDashboardViewModel
        {
            FromDate = from,
            ToDate = to,
            Attendance = await _repo.GetAttendancesAsync(from, to, userId),
            Kpis = await _repo.GetDailyKpisAsync(from, to, userId)
        };
    }

    public async Task<ApiResult> RecalculateKpiAsync(DateTime workDate, ICurrentUser currentUser)
    {
        var date = workDate.Date;
        var users = await _users.GetActiveUsersAsync();
        var attendances = await _repo.GetAttendancesAsync(date, date, null);
        var attMap = attendances.GroupBy(x => x.UserId).ToDictionary(g => g.Key, g => g.First().WorkHours);
        var conn = await _db.GetOpenConnectionAsync();

        foreach (var user in users)
        {
            const string sql = @"
SELECT
    d.current_step AS [Step],
    COUNT(1) AS Total,
    SUM(CASE WHEN d.is_checked1 = 1 OR d.is_checked2 = 1 OR d.is_extracted = 1 THEN 1 ELSE 0 END) AS Passed,
    SUM(CASE WHEN d.checked1return_reason IS NOT NULL OR d.checked2return_reason IS NOT NULL THEN 1 ELSE 0 END) AS Returned
FROM dbo.stg_documents d
WHERE d.status = 1
  AND d.updated_by = @UserId
  AND CONVERT(date, d.updated) = @WorkDate
GROUP BY d.current_step;";
            var rows = await conn.QueryAsync<KpiAggRow>(sql, new { UserId = user.Id, WorkDate = date });
            var wh = attMap.TryGetValue(user.Id, out var v) ? v : 0m;

            foreach (var row in rows)
            {
                var failed = Math.Max(0, row.Total - row.Passed);
                var quality = row.Total <= 0 ? 0m : Math.Round((row.Passed * 100m) / row.Total, 2);
                var avgMinutes = row.Total <= 0 || wh <= 0 ? 0m : Math.Round((wh * 60m) / row.Total, 2);
                await _repo.UpsertDailyKpiAsync(new ConstructionUserDailyKpi
                {
                    UserId = user.Id,
                    WorkDate = date,
                    Step = (WorkflowStep)row.Step,
                    BatchId = null,
                    DocumentsProcessed = row.Total,
                    DocumentsPassed = row.Passed,
                    DocumentsFailed = failed,
                    DocumentsReturned = row.Returned,
                    QualityScore = quality,
                    AvgMinutesPerDocument = avgMinutes,
                    WorkHours = wh,
                    Created = DateTime.UtcNow,
                    CreatedBy = currentUser.Id,
                    Updated = DateTime.UtcNow,
                    UpdatedBy = currentUser.Id
                });
            }
        }

        return ApiResult.Ok("Đã tính KPI ngày.");
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
        var atts = await _repo.GetAttendancesAsync(first, last, null);
        var users = await _users.GetActiveUsersAsync();
        var payrollConfig = await LoadPayrollConfigAsync();

        foreach (var user in users)
        {
            var userKpis = kpis.Where(x => x.UserId == user.Id).ToList();
            var userAtt = atts.Where(x => x.UserId == user.Id).ToList();

            var processed = userKpis.Sum(x => x.DocumentsProcessed);
            var avgQuality = userKpis.Count == 0 ? 0m : userKpis.Average(x => x.QualityScore);
            var workHours = userAtt.Sum(x => x.WorkHours);

            var baseSalary = payrollConfig.BaseSalary;
            var quantityAmount = processed * payrollConfig.RatePerDocument;
            var qualityBonus = avgQuality >= payrollConfig.QualityThresholdHigh
                ? payrollConfig.QualityBonusHigh
                : avgQuality >= payrollConfig.QualityThresholdMedium
                    ? payrollConfig.QualityBonusMedium
                    : 0m;
            var attendanceDeduction = workHours < payrollConfig.StandardWorkHours
                ? Math.Round((payrollConfig.StandardWorkHours - workHours) * payrollConfig.AttendanceDeductionPerHour, 0)
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

    private sealed class KpiAggRow
    {
        public byte Step { get; set; }
        public int Total { get; set; }
        public int Passed { get; set; }
        public int Returned { get; set; }
    }

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
            StandardWorkHours = ReadDecimal(map, "ConstructionPayrollStandardWorkHours", 176m),
            AttendanceDeductionPerHour = ReadDecimal(map, "ConstructionPayrollAttendanceDeductionPerHour", 20_000m)
        };
    }

    private static decimal ReadDecimal(IReadOnlyDictionary<string, string?> map, string key, decimal fallback)
    {
        if (!map.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
            return fallback;
        if (decimal.TryParse(raw, out var value))
            return value;
        return fallback;
    }

    private sealed class ConstructionPayrollConfig
    {
        public decimal BaseSalary { get; init; }
        public decimal RatePerDocument { get; init; }
        public decimal QualityThresholdHigh { get; init; }
        public decimal QualityBonusHigh { get; init; }
        public decimal QualityThresholdMedium { get; init; }
        public decimal QualityBonusMedium { get; init; }
        public decimal StandardWorkHours { get; init; }
        public decimal AttendanceDeductionPerHour { get; init; }
    }
}
