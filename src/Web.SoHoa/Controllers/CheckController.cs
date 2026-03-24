using Core.Application.Services;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Acc;
using Infrastructure.Data.Repositories.Stg;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.SoHoa.Controllers;

/// <summary>
/// Các màn hình kiểm tra: Check1, Check2, CheckFinal, CheckLogic.
/// </summary>
[Authorize]
[Route("check")]
public class CheckController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;
    private readonly IFormCellRepository _cellRepo;
    private readonly IUserRepository _userRepo;

    public CheckController(
        IDocumentService docService,
        IDocumentWorkflowService workflowService,
        IFormCellRepository cellRepo,
        IUserRepository userRepo)
    {
        _docService = docService;
        _workflowService = workflowService;
        _cellRepo = cellRepo;
        _userRepo = userRepo;
    }

    // --- CHECK 1 ---

    private void SetPageHeader(string title, string code)
    {
        ViewData["Title"] = title;
        ViewData["PageTitle"] = title;
        ViewData["PageIcon"] = "check-circle";
        ViewData["Breadcrumbs"] = new List<Web.Shared.BreadcrumbItem>
        {
            new() { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new() { Text = "Nhập liệu", Url = Url.Action("Index", "Extract") },
            new() { Text = title, Url = Url.Action(code == "check1" ? "Check1" : "Check2", "Check") }
        };
    }

    [HttpGet("check1")]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> Check1()
    {
        SetPageHeader("Kiểm tra lần 1", "check1");
        var req = new DocumentFilterRequest { Step = WorkflowStep.Check1, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpGet("check1/form/{id:long}")]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> Check1Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        ViewBag.Cells = await _cellRepo.GetByDocumentAsync(id);
        ViewBag.UserNames = await BuildUserMapAsync(doc);
        SetPageHeader($"Kiểm tra lần 1 - Hồ sơ #{id}", "check1");
        return View(doc);
    }

    [HttpPost("check1/submit")]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckFirst)]
    public async Task<IActionResult> DoCheck1([FromBody] CheckReviewRequest req)
        => JsonResult(await _workflowService.Check1Async(req, CurrentUser));

    // --- CHECK 2 ---

    [HttpGet("check2")]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> Check2()
    {
        SetPageHeader("Kiểm tra lần 2", "check2");
        var req = new DocumentFilterRequest { Step = WorkflowStep.Check2, PageIndex = GetPageRequest().PageIndex, PageSize = GetPageRequest().PageSize };
        return View(await _docService.GetListAsync(req, CurrentUser));
    }

    [HttpGet("check2/form/{id:long}")]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> Check2Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        ViewBag.Cells = await _cellRepo.GetByDocumentAsync(id);
        ViewBag.UserNames = await BuildUserMapAsync(doc);
        SetPageHeader($"Kiểm tra lần 2 - Hồ sơ #{id}", "check2");
        return View(doc);
    }

    private async Task<Dictionary<int, string>> BuildUserMapAsync(DocumentDto doc)
    {
        var userIds = new[] { doc.CreatedBy, doc.ExtractedBy, doc.Checked1By, doc.Checked2By }
            .Where(x => x > 0)
            .Distinct()
            .ToList();
        var names = new Dictionary<int, string>();
        foreach (var uid in userIds)
        {
            var u = await _userRepo.GetByIdAsync(uid);
            names[uid] = u?.FullName ?? u?.UserName ?? $"User #{uid}";
        }
        return names;
    }

    [HttpPost("check2/submit")]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckSecond)]
    public async Task<IActionResult> DoCheck2([FromBody] CheckReviewRequest req)
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
