using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Identity;

namespace SHTL.Modules.Features.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.Report)]
public class ReportController : BaseController
{
    private readonly IFolderProgressReportService _folderProgress;

    public ReportController(IFolderProgressReportService folderProgress)
    {
        _folderProgress = folderProgress;
    }

    [HttpGet("/sohoa/report/folder-progress")]
    public async Task<IActionResult> FolderProgress([FromQuery] string? q = null)
    {
        var vm = await _folderProgress.GetAsync(q);
        return View(vm);
    }
}
