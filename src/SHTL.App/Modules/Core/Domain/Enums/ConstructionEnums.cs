namespace SHTL.Modules.Core.Domain.Enums;

public enum ConstructionBatchStatus : byte
{
    Draft = 0,
    Active = 1,
    InProgress = 2,
    Completed = 3,
    Suspended = 4,
    Archived = 5
}

public enum ConstructionAssignmentStatus : byte
{
    Active = 1,
    Completed = 2,
    Revoked = 3
}

public enum ConstructionDocStatus : byte
{
    Pending = 0,
    InProgress = 1,
    Done = 2,
    Returned = 3,
    Failed = 4
}

public enum ConstructionPayrollStatus : byte
{
    Draft = 0,
    Approved = 1,
    Paid = 2
}
