using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Shared.Contracts.Dtos;

public sealed class ConstructionAttendanceDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public decimal WorkHours { get; set; }
    public bool IsPresent => WorkHours > 0;
}

public sealed class ConstructionKpiDailyDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public WorkflowStep Step { get; set; }
    public int DocumentsProcessed { get; set; }
    public int DocumentsPassed { get; set; }
    public int DocumentsFailed { get; set; }
    public int DocumentsReturned { get; set; }
    public decimal QualityScore { get; set; }
    public decimal AvgMinutesPerDocument { get; set; }
    public decimal WorkHours { get; set; }
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

public sealed class ConstructionKpiDashboardViewModel
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public IReadOnlyList<ConstructionAttendanceDto> Attendance { get; set; } = Array.Empty<ConstructionAttendanceDto>();
    public IReadOnlyList<ConstructionKpiDailyDto> Kpis { get; set; } = Array.Empty<ConstructionKpiDailyDto>();
}

public sealed class ConstructionPayrollDashboardViewModel
{
    public int Year { get; set; }
    public int Month { get; set; }
    public IReadOnlyList<ConstructionPayrollDto> Entries { get; set; } = Array.Empty<ConstructionPayrollDto>();
}
