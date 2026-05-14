using SHTL.Modules.Core.Domain.Enums;

namespace SHTL.Modules.Shared.Contracts.Dtos;

public sealed class ConstructionBatchListItemDto
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ConstructionBatchStatus Status { get; set; }
    public int TotalDocuments { get; set; }
    public int CompletedDocuments { get; set; }
    public int AssignedUsers { get; set; }
    public DateTime Created { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
}

public sealed class ConstructionBatchDetailsDto
{
    public ConstructionBatchListItemDto Batch { get; set; } = new();
    public IReadOnlyList<ConstructionBatchAssignmentDto> Assignments { get; set; } = Array.Empty<ConstructionBatchAssignmentDto>();
    public IReadOnlyList<ConstructionBatchStepProgressDto> StepProgress { get; set; } = Array.Empty<ConstructionBatchStepProgressDto>();
}

public sealed class ConstructionBatchAssignmentDto
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public WorkflowStep Step { get; set; }
    public ConstructionAssignmentStatus Status { get; set; }
    public DateTime AssignedAt { get; set; }
}

public sealed class ConstructionBatchStepProgressDto
{
    public WorkflowStep Step { get; set; }
    public int Total { get; set; }
    public int Pending { get; set; }
    public int InProgress { get; set; }
    public int Done { get; set; }
    public int Returned { get; set; }
    public int Failed { get; set; }
    public decimal CompletionPercent { get; set; }
}

public sealed class ConstructionCreateBatchRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long? FolderId { get; set; }
    public DateTime? DueAt { get; set; }
}

public sealed class ConstructionAssignBatchRequest
{
    public long BatchId { get; set; }
    public List<ConstructionAssignUserStepItem> Items { get; set; } = new();
}

public sealed class ConstructionAssignUserStepItem
{
    public int UserId { get; set; }
    public WorkflowStep Step { get; set; }
}

public sealed class ConstructionDashboardViewModel
{
    public int TotalBatches { get; set; }
    public int ActiveBatches { get; set; }
    public int CompletedBatches { get; set; }
    public int TotalDocuments { get; set; }
    public int CompletedDocuments { get; set; }
    public decimal CompletionPercent { get; set; }
    public IReadOnlyList<ConstructionBatchListItemDto> LatestBatches { get; set; } = Array.Empty<ConstructionBatchListItemDto>();
}

public sealed class ConstructionFolderBatchPageViewModel
{
    public string Filter { get; set; } = string.Empty;
    public string CurrentFolderPath { get; set; } = string.Empty;
    public string? ParentFolderPath { get; set; }
    public IReadOnlyList<string> BreadcrumbSegments { get; set; } = Array.Empty<string>();
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
    public IReadOnlyList<ConstructionFolderBatchRowViewModel> Rows { get; set; } = Array.Empty<ConstructionFolderBatchRowViewModel>();
}

public sealed class ConstructionFolderBatchRowViewModel
{
    public string FolderName { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty;
    public bool HasChildren { get; set; }
    public bool IsPdfFile { get; set; }
    public int TotalDocuments { get; set; }
    public int PendingCheckScan1 { get; set; }
    public int PendingCheckScan2 { get; set; }
    public int PendingExtract { get; set; }
    public int PendingCheck1 { get; set; }
    public int PendingCheck2 { get; set; }
}

public sealed class ConstructionDistributeFormsDialogViewModel
{
    public string FolderPath { get; set; } = string.Empty;
    public WorkflowStep Step { get; set; }
    public string StepLabel { get; set; } = string.Empty;
    public int AvailableCount { get; set; }
    public IReadOnlyList<ConstructionDistributeUserOption> Users { get; set; } = Array.Empty<ConstructionDistributeUserOption>();
    public IReadOnlyList<ConstructionDistributeDeptOption> Depts { get; set; } = Array.Empty<ConstructionDistributeDeptOption>();
}

public sealed class ConstructionDistributeUserOption
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int DeptId { get; set; }
}

public sealed class ConstructionDistributeDeptOption
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class ConstructionDistributeFormsRequest
{
    public string FolderPath { get; set; } = string.Empty;
    public WorkflowStep Step { get; set; }
    public int Quantity { get; set; }
    public int UserId { get; set; }
    public int? DeptId { get; set; }
    public string? Filter { get; set; }
}
