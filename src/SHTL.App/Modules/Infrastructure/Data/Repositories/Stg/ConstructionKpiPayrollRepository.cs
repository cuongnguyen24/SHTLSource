using Dapper;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IConstructionKpiPayrollRepository
{
    Task<long> UpsertAttendanceAsync(ConstructionAttendance row);
    Task<IReadOnlyList<ConstructionAttendanceDto>> GetAttendancesAsync(DateTime fromDate, DateTime toDate, int? userId = null);
    Task<long> UpsertDailyKpiAsync(ConstructionUserDailyKpi row);
    Task<IReadOnlyList<ConstructionKpiDailyDto>> GetDailyKpisAsync(DateTime fromDate, DateTime toDate, int? userId = null);
    Task<long> UpsertPayrollAsync(ConstructionPayrollEntry row);
    Task<IReadOnlyList<ConstructionPayrollDto>> GetPayrollAsync(int year, int month, int? userId = null);
}

public sealed class ConstructionKpiPayrollRepository : BaseRepository, IConstructionKpiPayrollRepository
{
    public ConstructionKpiPayrollRepository(AppDbContext db) : base(db) { }

    public async Task<long> UpsertAttendanceAsync(ConstructionAttendance row)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF EXISTS (SELECT 1 FROM dbo.stg_construction_attendances WHERE user_id = @UserId AND work_date = @WorkDate)
BEGIN
    UPDATE dbo.stg_construction_attendances
    SET check_in_at = @CheckInAt,
        check_out_at = @CheckOutAt,
        work_hours = @WorkHours,
        notes = @Notes,
        updated = @Updated,
        updated_by = @UpdatedBy
    WHERE user_id = @UserId AND work_date = @WorkDate;
    SELECT id FROM dbo.stg_construction_attendances WHERE user_id = @UserId AND work_date = @WorkDate;
END
ELSE
BEGIN
    INSERT INTO dbo.stg_construction_attendances
        (user_id, work_date, check_in_at, check_out_at, work_hours, notes, created, created_by, updated, updated_by)
    OUTPUT INSERTED.id
    VALUES
        (@UserId, @WorkDate, @CheckInAt, @CheckOutAt, @WorkHours, @Notes, @Created, @CreatedBy, @Updated, @UpdatedBy);
END";
        return await ExecuteScalarAsync<long>(conn, sql, row);
    }

    public async Task<IReadOnlyList<ConstructionAttendanceDto>> GetAttendancesAsync(DateTime fromDate, DateTime toDate, int? userId = null)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT
    a.user_id AS UserId,
    u.user_name AS UserName,
    u.full_name AS FullName,
    a.work_date AS WorkDate,
    a.work_hours AS WorkHours
FROM dbo.stg_construction_attendances a
LEFT JOIN dbo.acc_users u ON u.id = a.user_id
WHERE a.work_date >= @FromDate
  AND a.work_date < @ToDate
  AND (@UserId IS NULL OR a.user_id = @UserId)
ORDER BY a.work_date DESC, u.full_name, u.user_name;";
        var rows = await QueryAsync<ConstructionAttendanceDto>(conn, sql, new
        {
            FromDate = fromDate.Date,
            ToDate = toDate.Date.AddDays(1),
            UserId = userId
        });
        return rows.ToList();
    }

    public async Task<long> UpsertDailyKpiAsync(ConstructionUserDailyKpi row)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF EXISTS (
    SELECT 1
    FROM dbo.stg_construction_user_daily_kpis
    WHERE user_id = @UserId
      AND work_date = @WorkDate
      AND step = @Step
      AND ISNULL(batch_id, 0) = ISNULL(@BatchId, 0)
)
BEGIN
    UPDATE dbo.stg_construction_user_daily_kpis
    SET documents_processed = @DocumentsProcessed,
        documents_passed = @DocumentsPassed,
        documents_failed = @DocumentsFailed,
        documents_returned = @DocumentsReturned,
        quality_score = @QualityScore,
        avg_minutes_per_document = @AvgMinutesPerDocument,
        work_hours = @WorkHours,
        updated = @Updated,
        updated_by = @UpdatedBy
    WHERE user_id = @UserId
      AND work_date = @WorkDate
      AND step = @Step
      AND ISNULL(batch_id, 0) = ISNULL(@BatchId, 0);

    SELECT id
    FROM dbo.stg_construction_user_daily_kpis
    WHERE user_id = @UserId
      AND work_date = @WorkDate
      AND step = @Step
      AND ISNULL(batch_id, 0) = ISNULL(@BatchId, 0);
END
ELSE
BEGIN
    INSERT INTO dbo.stg_construction_user_daily_kpis
        (user_id, work_date, step, batch_id, documents_processed, documents_passed, documents_failed, documents_returned,
         quality_score, avg_minutes_per_document, work_hours, created, created_by, updated, updated_by)
    OUTPUT INSERTED.id
    VALUES
        (@UserId, @WorkDate, @Step, @BatchId, @DocumentsProcessed, @DocumentsPassed, @DocumentsFailed, @DocumentsReturned,
         @QualityScore, @AvgMinutesPerDocument, @WorkHours, @Created, @CreatedBy, @Updated, @UpdatedBy);
END";
        return await ExecuteScalarAsync<long>(conn, sql, new
        {
            row.UserId,
            WorkDate = row.WorkDate.Date,
            Step = (byte)row.Step,
            row.BatchId,
            row.DocumentsProcessed,
            row.DocumentsPassed,
            row.DocumentsFailed,
            row.DocumentsReturned,
            row.QualityScore,
            row.AvgMinutesPerDocument,
            row.WorkHours,
            row.Created,
            row.CreatedBy,
            row.Updated,
            row.UpdatedBy
        });
    }

    public async Task<IReadOnlyList<ConstructionKpiDailyDto>> GetDailyKpisAsync(DateTime fromDate, DateTime toDate, int? userId = null)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT
    k.user_id AS UserId,
    u.user_name AS UserName,
    u.full_name AS FullName,
    k.work_date AS WorkDate,
    k.step AS Step,
    k.documents_processed AS DocumentsProcessed,
    k.documents_passed AS DocumentsPassed,
    k.documents_failed AS DocumentsFailed,
    k.documents_returned AS DocumentsReturned,
    k.quality_score AS QualityScore,
    k.avg_minutes_per_document AS AvgMinutesPerDocument,
    k.work_hours AS WorkHours
FROM dbo.stg_construction_user_daily_kpis k
LEFT JOIN dbo.acc_users u ON u.id = k.user_id
WHERE k.work_date >= @FromDate
  AND k.work_date < @ToDate
  AND (@UserId IS NULL OR k.user_id = @UserId)
ORDER BY k.work_date DESC, u.full_name, u.user_name, k.step;";
        var rows = await QueryAsync<ConstructionKpiDailyDto>(conn, sql, new
        {
            FromDate = fromDate.Date,
            ToDate = toDate.Date.AddDays(1),
            UserId = userId
        });
        return rows.ToList();
    }

    public async Task<long> UpsertPayrollAsync(ConstructionPayrollEntry row)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF EXISTS (
    SELECT 1 FROM dbo.stg_construction_payroll_entries
    WHERE user_id = @UserId AND [year] = @Year AND [month] = @Month
)
BEGIN
    UPDATE dbo.stg_construction_payroll_entries
    SET base_salary = @BaseSalary,
        quantity_amount = @QuantityAmount,
        quality_bonus = @QualityBonus,
        attendance_deduction = @AttendanceDeduction,
        total_salary = @TotalSalary,
        [status] = @Status,
        approved_at = @ApprovedAt,
        approved_by = @ApprovedBy,
        updated = @Updated,
        updated_by = @UpdatedBy
    WHERE user_id = @UserId AND [year] = @Year AND [month] = @Month;

    SELECT id FROM dbo.stg_construction_payroll_entries WHERE user_id = @UserId AND [year] = @Year AND [month] = @Month;
END
ELSE
BEGIN
    INSERT INTO dbo.stg_construction_payroll_entries
        (user_id, [year], [month], base_salary, quantity_amount, quality_bonus, attendance_deduction, total_salary,
         [status], approved_at, approved_by, created, created_by, updated, updated_by)
    OUTPUT INSERTED.id
    VALUES
        (@UserId, @Year, @Month, @BaseSalary, @QuantityAmount, @QualityBonus, @AttendanceDeduction, @TotalSalary,
         @Status, @ApprovedAt, @ApprovedBy, @Created, @CreatedBy, @Updated, @UpdatedBy);
END";
        return await ExecuteScalarAsync<long>(conn, sql, new
        {
            row.UserId,
            row.Year,
            row.Month,
            row.BaseSalary,
            row.QuantityAmount,
            row.QualityBonus,
            row.AttendanceDeduction,
            row.TotalSalary,
            Status = (byte)row.Status,
            row.ApprovedAt,
            row.ApprovedBy,
            row.Created,
            row.CreatedBy,
            row.Updated,
            row.UpdatedBy
        });
    }

    public async Task<IReadOnlyList<ConstructionPayrollDto>> GetPayrollAsync(int year, int month, int? userId = null)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT
    p.id AS Id,
    p.user_id AS UserId,
    u.user_name AS UserName,
    u.full_name AS FullName,
    p.[year] AS [Year],
    p.[month] AS [Month],
    p.base_salary AS BaseSalary,
    p.quantity_amount AS QuantityAmount,
    p.quality_bonus AS QualityBonus,
    p.attendance_deduction AS AttendanceDeduction,
    p.total_salary AS TotalSalary,
    p.[status] AS [Status]
FROM dbo.stg_construction_payroll_entries p
LEFT JOIN dbo.acc_users u ON u.id = p.user_id
WHERE p.[year] = @Year
  AND p.[month] = @Month
  AND (@UserId IS NULL OR p.user_id = @UserId)
ORDER BY u.full_name, u.user_name;";
        var rows = await QueryAsync<ConstructionPayrollDto>(conn, sql, new { Year = year, Month = month, UserId = userId });
        return rows.ToList();
    }
}
