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
/// Màn hình nhập liệu (extract) - người dùng điền giá trị vào các field.
/// </summary>
[Authorize]
[AuthorizeModule(ModuleCode.ExtractDigit, ModuleCode.ExtractAlphabet, ModuleCode.ExtractForm)]
public class ExtractController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;
    private readonly IFormCellRepository _cellRepo;
    private readonly IUserRepository _userRepo;

    public ExtractController(
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

    // GET /extract - Danh sách tài liệu chờ nhập liệu
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        WorkflowStep? step = WorkflowStep.Extract;
        if (Enum.TryParse<WorkflowStep>(Request.Query["step"], true, out var parsedStep))
            step = parsedStep;

        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Search = Request.Query["q"],
            Step = step
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        return View(result);
    }

    // GET /extract/take - Nhận nhanh 1 tài liệu để nhập
    [HttpGet]
    public async Task<IActionResult> Take()
    {
        var req = new DocumentFilterRequest
        {
            PageIndex = 1,
            PageSize = 1,
            Step = WorkflowStep.Extract
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        var doc = result.Items.FirstOrDefault();
        if (doc is null)
        {
            SetWarning("Hiện không có tài liệu nào chờ nhập liệu.");
            return RedirectToAction(nameof(Index));
        }

        return RedirectToAction(nameof(Form), new { id = doc.Id });
    }

    // GET /extract/form/{id} - Form nhập liệu
    [HttpGet]
    public async Task<IActionResult> Form(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();

        var cells = await _cellRepo.GetByDocumentAsync(id);
        ViewBag.Cells = cells;
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
        ViewBag.UserNames = names;
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
