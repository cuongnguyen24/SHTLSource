using Core.Application.Services;
using Core.Domain.Enums;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.SoHoa.Controllers;

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

    // POST /export/request
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Request([FromBody] ExportRequestBody body)
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
