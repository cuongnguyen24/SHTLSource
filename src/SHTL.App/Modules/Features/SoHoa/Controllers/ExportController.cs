using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.ExportData)]
public class ExportController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;

    public ExportController(IDocumentService docService, IDocumentWorkflowService workflowService)
    {
        _docService = docService;
        _workflowService = workflowService;
    }

    // GET /export - Danh sách tài liệu sẵn sàng export
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var req = new DocumentFilterRequest
        {
            Step = WorkflowStep.Export,
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize
        };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    // POST .../Request
    [HttpPost]
    [ValidateAntiForgeryToken]
    [ActionName("Request")]
    public async Task<IActionResult> RequestExport([FromBody] ExportRequestBody body)
    {
        var result = await _workflowService.RequestExportAsync(body.DocumentId, body.ExportType, CurrentUser);
        return JsonResult(result);
    }

    public class ExportRequestBody
    {
        public long DocumentId { get; set; }
        public string ExportType { get; set; } = "default";
    }
}
