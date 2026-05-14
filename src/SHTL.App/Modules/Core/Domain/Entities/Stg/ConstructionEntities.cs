using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Core.Domain.Entities.Stg;

public class ConstructionBatch : TenantEntity
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long? FolderId { get; set; }
    public int? AssignedToUserId { get; set; }
    public int? AssignedToDeptId { get; set; }
    public ConstructionBatchStatus Status { get; set; } = ConstructionBatchStatus.Draft;
    public int TotalDocuments { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? DueAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class ConstructionBatchAssignment : TenantEntity
{
    public long Id { get; set; }
    public long BatchId { get; set; }
    public int UserId { get; set; }
    public WorkflowStep Step { get; set; }
    public ConstructionAssignmentStatus Status { get; set; } = ConstructionAssignmentStatus.Active;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public int AssignedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class ConstructionBatchDocument : TenantEntity
{
    public long Id { get; set; }
    public long BatchId { get; set; }
    public long DocumentId { get; set; }
    public long? AssignmentId { get; set; }
    public WorkflowStep CurrentStep { get; set; }
    public ConstructionDocStatus Status { get; set; } = ConstructionDocStatus.Pending;
    public bool IsOwnedByUploader { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class ConstructionUserDailyKpi : TenantEntity
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public DateTime WorkDate { get; set; }
    public WorkflowStep Step { get; set; }
    public long? BatchId { get; set; }
    public int DocumentsProcessed { get; set; }
    public int DocumentsPassed { get; set; }
    public int DocumentsFailed { get; set; }
    public int DocumentsReturned { get; set; }
    public decimal QualityScore { get; set; }
    public decimal AvgMinutesPerDocument { get; set; }
    public decimal WorkHours { get; set; }
}

public class ConstructionAttendance : TenantEntity
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public DateTime WorkDate { get; set; }
    public DateTime? CheckInAt { get; set; }
    public DateTime? CheckOutAt { get; set; }
    public decimal WorkHours { get; set; }
    public string? Notes { get; set; }
}

public class ConstructionPayrollEntry : TenantEntity
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal QuantityAmount { get; set; }
    public decimal QualityBonus { get; set; }
    public decimal AttendanceDeduction { get; set; }
    public decimal TotalSalary { get; set; }
    public ConstructionPayrollStatus Status { get; set; } = ConstructionPayrollStatus.Draft;
    public DateTime? ApprovedAt { get; set; }
    public int ApprovedBy { get; set; }
}
