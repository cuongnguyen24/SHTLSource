using Core.Domain.Contracts;
using Web.Shared;

namespace Web.Dashboard.Models;

public class DashboardIndexVm
{
    public required ShellOptions Links { get; init; }
    public ICurrentUser? User { get; init; }
}
