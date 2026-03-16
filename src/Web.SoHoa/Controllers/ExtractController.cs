using Core.Application.Services;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Stg;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.SoHoa.Controllers;

/// <summary>
/// Màn hình nhập liệu (extract) - người dùng điền giá trị vào các field.
/// </summary>
[Authorize]
[AuthorizeModule(ModuleCode.ExtractDigit, ModuleCode.ExtractAlphabet, ModuleCode.ExtractForm)]
public class ExtractController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;
    private readonly IFormCellRepository _cellRepo;

    public ExtractController(
        IDocumentService docService,
        IDocumentWorkflowService workflowService,
        IFormCellRepository cellRepo)
    {
        _docService = docService;
        _workflowService = workflowService;
        _cellRepo = cellRepo;
    }

    // GET /extract - Danh sách tài liệu chờ nhập liệu
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Search = Request.Query["q"],
            Step = WorkflowStep.Extract
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        return View(result);
    }

    // GET /extract/form/{id} - Form nhập liệu
    [HttpGet]
    public async Task<IActionResult> Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        if (doc.CurrentStep != WorkflowStep.Extract && doc.CurrentStep != WorkflowStep.Ocr)
        {
            SetError($"Tài liệu đang ở bước {doc.CurrentStep}, không phải bước nhập liệu");
            return RedirectToAction("Index");
        }

        var cells = await _cellRepo.GetByDocumentAsync(id);
        ViewBag.Cells = cells;
        return View(doc);
    }

    // POST /extract/submit
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Submit([FromBody] ExtractRequest req)
    {
        var result = await _workflowService.SubmitExtractAsync(req, CurrentUser);
        return JsonResult(result);
    }
}
