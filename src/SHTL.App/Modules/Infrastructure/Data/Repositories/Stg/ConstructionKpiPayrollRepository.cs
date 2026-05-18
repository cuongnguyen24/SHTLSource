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
    Task<long> SavePayrollHistoryAsync(int year, int month, DateTime periodFrom, DateTime periodTo, int createdBy, string? note = null);
    Task<IReadOnlyList<ConstructionPayrollHistoryDto>> GetPayrollHistoriesAsync();
    Task<IReadOnlyList<ConstructionPayrollHistoryItemDto>> GetPayrollHistoryItemsAsync(long historyId);
    Task<ConstructionPayrollHistoryDto?> GetPayrollHistoryByIdAsync(long historyId);
    Task<int> RollbackPayrollApprovalAsync(long payrollId, int updatedBy);
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
    a.work_hours AS WorkHours,
    a.notes AS Notes
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

    public async Task<long> SavePayrollHistoryAsync(int year, int month, DateTime periodFrom, DateTime periodTo, int createdBy, string? note = null)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF OBJECT_ID('dbo.stg_construction_payroll_histories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stg_construction_payroll_histories
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        [year] INT NOT NULL,
        [month] INT NOT NULL,
        period_from DATE NOT NULL,
        period_to DATE NOT NULL,
        total_users INT NOT NULL,
        total_amount DECIMAL(18,2) NOT NULL,
        note NVARCHAR(500) NULL,
        created DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_by INT NOT NULL DEFAULT 0
    );
END;

IF OBJECT_ID('dbo.stg_construction_payroll_history_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stg_construction_payroll_history_items
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        history_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        user_name NVARCHAR(128) NULL,
        full_name NVARCHAR(255) NULL,
        base_salary DECIMAL(18,2) NOT NULL,
        quantity_amount DECIMAL(18,2) NOT NULL,
        quality_bonus DECIMAL(18,2) NOT NULL,
        attendance_deduction DECIMAL(18,2) NOT NULL,
        total_salary DECIMAL(18,2) NOT NULL,
        [status] TINYINT NOT NULL
    );
END;

IF EXISTS (
    SELECT 1 FROM dbo.stg_construction_payroll_entries
    WHERE [year] = @Year AND [month] = @Month AND [status] = 0
)
BEGIN
    RAISERROR (N'Vẫn còn phiếu lương chưa chốt. Không thể lưu lịch sử trả lương.', 16, 1);
    RETURN;
END;

DECLARE @HistoryId BIGINT;
INSERT INTO dbo.stg_construction_payroll_histories
    ([year], [month], period_from, period_to, total_users, total_amount, note, created, created_by)
SELECT
    @Year,
    @Month,
    @PeriodFrom,
    @PeriodTo,
    COUNT(1),
    ISNULL(SUM(total_salary), 0),
    @Note,
    SYSUTCDATETIME(),
    @CreatedBy
FROM dbo.stg_construction_payroll_entries
WHERE [year] = @Year AND [month] = @Month;

SET @HistoryId = SCOPE_IDENTITY();

INSERT INTO dbo.stg_construction_payroll_history_items
    (history_id, user_id, user_name, full_name, base_salary, quantity_amount, quality_bonus, attendance_deduction, total_salary, [status])
SELECT
    @HistoryId,
    p.user_id,
    u.user_name,
    u.full_name,
    p.base_salary,
    p.quantity_amount,
    p.quality_bonus,
    p.attendance_deduction,
    p.total_salary,
    p.[status]
FROM dbo.stg_construction_payroll_entries p
LEFT JOIN dbo.acc_users u ON u.id = p.user_id
WHERE p.[year] = @Year AND p.[month] = @Month;

SELECT @HistoryId;";

        return await ExecuteScalarAsync<long>(conn, sql, new
        {
            Year = year,
            Month = month,
            PeriodFrom = periodFrom.Date,
            PeriodTo = periodTo.Date,
            CreatedBy = createdBy,
            Note = note
        });
    }

    public async Task<IReadOnlyList<ConstructionPayrollHistoryDto>> GetPayrollHistoriesAsync()
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF OBJECT_ID('dbo.stg_construction_payroll_histories', 'U') IS NULL
BEGIN
    SELECT
        CAST(NULL AS BIGINT) AS Id,
        CAST(NULL AS INT) AS [Year],
        CAST(NULL AS INT) AS [Month],
        CAST(NULL AS DATE) AS PeriodFrom,
        CAST(NULL AS DATE) AS PeriodTo,
        CAST(NULL AS INT) AS TotalUsers,
        CAST(NULL AS DECIMAL(18,2)) AS TotalAmount,
        CAST(NULL AS NVARCHAR(500)) AS Note,
        CAST(NULL AS DATETIME2) AS CreatedAt,
        CAST(NULL AS NVARCHAR(255)) AS CreatedByName
    WHERE 1 = 0;
    RETURN;
END;

SELECT
    h.id AS Id,
    h.[year] AS [Year],
    h.[month] AS [Month],
    h.period_from AS PeriodFrom,
    h.period_to AS PeriodTo,
    h.total_users AS TotalUsers,
    h.total_amount AS TotalAmount,
    h.note AS Note,
    h.created AS CreatedAt,
    ISNULL(u.full_name, u.user_name) AS CreatedByName
FROM dbo.stg_construction_payroll_histories h
LEFT JOIN dbo.acc_users u ON u.id = h.created_by
ORDER BY h.[year] DESC, h.[month] DESC, h.id DESC;";
        var rows = await QueryAsync<ConstructionPayrollHistoryDto>(conn, sql);
        return rows.ToList();
    }

    public async Task<IReadOnlyList<ConstructionPayrollHistoryItemDto>> GetPayrollHistoryItemsAsync(long historyId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF OBJECT_ID('dbo.stg_construction_payroll_history_items', 'U') IS NULL
BEGIN
    SELECT
        CAST(NULL AS NVARCHAR(128)) AS UserName,
        CAST(NULL AS NVARCHAR(255)) AS FullName,
        CAST(NULL AS DECIMAL(18,2)) AS BaseSalary,
        CAST(NULL AS DECIMAL(18,2)) AS QuantityAmount,
        CAST(NULL AS DECIMAL(18,2)) AS QualityBonus,
        CAST(NULL AS DECIMAL(18,2)) AS AttendanceDeduction,
        CAST(NULL AS DECIMAL(18,2)) AS TotalSalary,
        CAST(NULL AS NVARCHAR(50)) AS [Status]
    WHERE 1 = 0;
    RETURN;
END;

SELECT
    i.user_id AS UserId,
    i.user_name AS UserName,
    i.full_name AS FullName,
    i.base_salary AS BaseSalary,
    i.quantity_amount AS QuantityAmount,
    i.quality_bonus AS QualityBonus,
    i.attendance_deduction AS AttendanceDeduction,
    i.total_salary AS TotalSalary,
    CASE i.[status] WHEN 1 THEN N'Approved' ELSE N'Draft' END AS [Status]
FROM dbo.stg_construction_payroll_history_items i
WHERE i.history_id = @HistoryId
ORDER BY i.full_name, i.user_name;";
        var rows = await QueryAsync<ConstructionPayrollHistoryItemDto>(conn, sql, new { HistoryId = historyId });
        return rows.ToList();
    }

    public async Task<ConstructionPayrollHistoryDto?> GetPayrollHistoryByIdAsync(long historyId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
IF OBJECT_ID('dbo.stg_construction_payroll_histories', 'U') IS NULL
BEGIN
    SELECT
        CAST(NULL AS BIGINT) AS Id,
        CAST(NULL AS INT) AS [Year],
        CAST(NULL AS INT) AS [Month],
        CAST(NULL AS DATE) AS PeriodFrom,
        CAST(NULL AS DATE) AS PeriodTo,
        CAST(NULL AS INT) AS TotalUsers,
        CAST(NULL AS DECIMAL(18,2)) AS TotalAmount,
        CAST(NULL AS NVARCHAR(500)) AS Note,
        CAST(NULL AS DATETIME2) AS CreatedAt,
        CAST(NULL AS NVARCHAR(255)) AS CreatedByName
    WHERE 1 = 0;
    RETURN;
END;

SELECT
    h.id AS Id,
    h.[year] AS [Year],
    h.[month] AS [Month],
    h.period_from AS PeriodFrom,
    h.period_to AS PeriodTo,
    h.total_users AS TotalUsers,
    h.total_amount AS TotalAmount,
    h.note AS Note,
    h.created AS CreatedAt,
    ISNULL(u.full_name, u.user_name) AS CreatedByName
FROM dbo.stg_construction_payroll_histories h
LEFT JOIN dbo.acc_users u ON u.id = h.created_by
WHERE h.id = @HistoryId;";
        return await QueryFirstOrDefaultAsync<ConstructionPayrollHistoryDto>(conn, sql, new { HistoryId = historyId });
    }

    public async Task<int> RollbackPayrollApprovalAsync(long payrollId, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
UPDATE dbo.stg_construction_payroll_entries
SET [status] = 0,
    approved_at = NULL,
    approved_by = 0,
    updated = SYSUTCDATETIME(),
    updated_by = @UpdatedBy
WHERE id = @Id;";
        return await ExecuteAsync(conn, sql, new { Id = payrollId, UpdatedBy = updatedBy });
    }
}
