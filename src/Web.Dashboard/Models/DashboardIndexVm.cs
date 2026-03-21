using Core.Domain.Contracts;

namespace Web.Dashboard.Models;

public class DashboardIndexVm
{
    public required DashboardModuleLinks Links { get; init; }
    public ICurrentUser? User { get; init; }
}
