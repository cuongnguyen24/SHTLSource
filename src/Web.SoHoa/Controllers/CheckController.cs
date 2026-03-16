using Core.Application.Services;
using Core.Domain.Enums;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.SoHoa.Controllers;

/// <summary>
/// Các màn hình kiểm tra: Check1, Check2, CheckFinal, CheckLogic.
/// </summary>
[Authorize]
public class CheckController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;

    public CheckController(IDocumentService docService, IDocumentWorkflowService workflowService)
    {
        _docService = docService;
        _workflowService = workflowService;
    }

    // --- CHECK 1 ---

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> Check1()
    {
        var req = new DocumentFilterRequest { Step = WorkflowStep.Check1, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> Check1Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        return View(doc);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> DoCheck1([FromBody] WorkflowActionRequest req)
        => JsonResult(await _workflowService.Check1Async(req, CurrentUser));

    // --- CHECK 2 ---

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> Check2()
    {
        var req = new DocumentFilterRequest { Step = WorkflowStep.Check2, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> Check2Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        return View(doc);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> DoCheck2([FromBody] WorkflowActionRequest req)
        => JsonResult(await _workflowService.Check2Async(req, CurrentUser));

    // --- CHECK FINAL ---

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckFinal)]
    public async Task<IActionResult> CheckFinal()
    {
        var req = new DocumentFilterRequest { Step = WorkflowStep.CheckFinal, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckFinal)]
    public async Task<IActionResult> DoCheckFinal([FromBody] WorkflowActionRequest req)
        => JsonResult(await _workflowService.CheckFinalAsync(req, CurrentUser));

    // --- CHECK LOGIC ---

    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckLogic)]
    public async Task<IActionResult> CheckLogic()
    {
        var req = new DocumentFilterRequest { Step = WorkflowStep.CheckLogic, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckLogic)]
    public async Task<IActionResult> DoCheckLogic([FromBody] WorkflowActionRequest req)
        => JsonResult(await _workflowService.CheckLogicAsync(req, CurrentUser));
}
