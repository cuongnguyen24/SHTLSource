using Core.Application.Services;
using Core.Domain.Enums;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.SoHoa.Controllers;

/// <summary>
/// Quản lý danh sách tài liệu scan/upload và các thao tác trên bước scan.
/// </summary>
[Authorize]
[AuthorizeModule(ModuleCode.ScanUpload, ModuleCode.CheckScanFirst, ModuleCode.CheckScanSecond)]
public class ScanController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;

    public ScanController(IDocumentService docService, IDocumentWorkflowService workflowService)
    {
        _docService = docService;
        _workflowService = workflowService;
    }

    // GET /scan - Danh sách tài liệu mới upload
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Search = Request.Query["q"],
            Step = WorkflowStep.Scan,
            StartDate = ParseDate(Request.Query["from"]),
            EndDate = ParseDate(Request.Query["to"])
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        ViewBag.Request = req;
        return View(result);
    }

    // GET /scan/check-scan1 - Danh sách chờ kiểm tra scan lần 1
    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckScanFirst)]
    public async Task<IActionResult> CheckScan1List()
    {
        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Step = WorkflowStep.CheckScan1
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        return View("CheckScan1", result);
    }

    // POST /scan/do-check-scan1
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckScanFirst)]
    public async Task<IActionResult> DoCheckScan1([FromBody] CheckScanRequest req)
    {
        var result = await _workflowService.CheckScan1Async(req, CurrentUser);
        return JsonResult(result);
    }

    // GET /scan/check-scan2
    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckScanSecond)]
    public async Task<IActionResult> CheckScan2List()
    {
        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Step = WorkflowStep.CheckScan2
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        return View("CheckScan2", result);
    }

    // POST /scan/do-check-scan2
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckScanSecond)]
    public async Task<IActionResult> DoCheckScan2([FromBody] CheckScanRequest req)
    {
        var result = await _workflowService.CheckScan2Async(req, CurrentUser);
        return JsonResult(result);
    }

    // GET /scan/detail/{id}
    [HttpGet]
    public async Task<IActionResult> Detail(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        return View(doc);
    }

    private static DateTime? ParseDate(string? s)
        => DateTime.TryParse(s, out var d) ? d : null;
}
