using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Shared.Contracts.Dtos;

public sealed class ConstructionAttendanceDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    /// <summary>1 = đủ KPI (1 công), 0 = chưa đủ.</summary>
    public decimal WorkHours { get; set; }
    public bool IsPresent => WorkHours >= 1m;
    public string? Notes { get; set; }
}

public sealed class ConstructionKpiDailyDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public WorkflowStep Step { get; set; }
    public ConstructionKpiRole? KpiRole { get; set; }
    public string StepDisplayName { get; set; } = string.Empty;
    public int DocumentsProcessed { get; set; }
    public int DocumentsPassed { get; set; }
    public int DocumentsFailed { get; set; }
    public int DocumentsReturned { get; set; }
    public decimal QualityScore { get; set; }
    public decimal AvgMinutesPerDocument { get; set; }
    public int DailyTarget { get; set; }
    public bool KpiMet { get; set; }
    public decimal BonusAmount { get; set; }
}

public sealed class ConstructionKpiRoleConfigDto
{
    public ConstructionKpiRole Role { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int DailyTarget { get; set; }
    public decimal MinQualityPercent { get; set; }
    public List<ConstructionKpiBonusTierDto> BonusTiers { get; set; } = new();
}

public sealed class ConstructionKpiBonusTierDto
{
    public int MinProcessed { get; set; }
    public decimal MinQualityPercent { get; set; }
    public decimal BonusAmount { get; set; }
}

public sealed class ConstructionKpiDashboardViewModel
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public IReadOnlyList<ConstructionAttendanceDto> Attendance { get; set; } = Array.Empty<ConstructionAttendanceDto>();
    public IReadOnlyList<ConstructionKpiDailyDto> Kpis { get; set; } = Array.Empty<ConstructionKpiDailyDto>();
    public IReadOnlyList<ConstructionKpiRoleConfigDto> RoleConfigs { get; set; } = Array.Empty<ConstructionKpiRoleConfigDto>();
    public IReadOnlyList<ConstructionKpiPeriodStatsDto> PeriodStats { get; set; } = Array.Empty<ConstructionKpiPeriodStatsDto>();
}

public sealed class ConstructionKpiPeriodStatsDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalProcessed { get; set; }
    public decimal AverageQuality { get; set; }
    public decimal TotalBonus { get; set; }
    public decimal TotalWorkDays { get; set; }
    public int TotalRows { get; set; }
    public int KpiMetRows { get; set; }
}

public sealed class SaveConstructionKpiConfigRequest
{
    public ConstructionKpiRole Role { get; set; }
    public int DailyTarget { get; set; }
    public decimal MinQualityPercent { get; set; }
    public List<ConstructionKpiBonusTierDto> BonusTiers { get; set; } = new();
}

public sealed class ConstructionKpiConfigUpsertViewModel
{
    public bool IsEdit { get; set; }
    public string Title { get; set; } = string.Empty;
    public SaveConstructionKpiConfigRequest Form { get; set; } = new();
}

public sealed class ConstructionPayrollDto
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal QuantityAmount { get; set; }
    public decimal QualityBonus { get; set; }
    public decimal AttendanceDeduction { get; set; }
    public decimal TotalSalary { get; set; }
    public ConstructionPayrollStatus Status { get; set; }
}

public sealed class ConstructionPayrollDashboardViewModel
{
    public int Year { get; set; }
    public int Month { get; set; }
    public IReadOnlyList<ConstructionPayrollDto> Entries { get; set; } = Array.Empty<ConstructionPayrollDto>();
    public ConstructionPayrollConfigDto Config { get; set; } = new();
    public IReadOnlyList<ConstructionPayrollHistoryDto> Histories { get; set; } = Array.Empty<ConstructionPayrollHistoryDto>();
}

public sealed class ConstructionPayrollConfigDto
{
    public decimal BaseSalary { get; set; }
    public decimal RatePerDocument { get; set; }
    public decimal AttendanceDeductionPerDay { get; set; }
    public decimal QualityThresholdHigh { get; set; }
    public decimal QualityBonusHigh { get; set; }
    public decimal QualityThresholdMedium { get; set; }
    public decimal QualityBonusMedium { get; set; }
}

public sealed class ConstructionPayrollHistoryDto
{
    public long Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public int TotalUsers { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
}

public sealed class ConstructionPayrollHistoryItemDto
{
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public decimal BaseSalary { get; set; }
    public decimal QuantityAmount { get; set; }
    public decimal QualityBonus { get; set; }
    public decimal AttendanceDeduction { get; set; }
    public decimal TotalSalary { get; set; }
    public string Status { get; set; } = string.Empty;
}
