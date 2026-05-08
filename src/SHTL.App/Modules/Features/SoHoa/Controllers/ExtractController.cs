using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;
using System.Text;

namespace SHTL.Modules.Features.SoHoa.Controllers;

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
    private readonly IDocumentFormViewModelBuilder _formBuilder;
    private readonly ILogger<ExtractController> _logger;
    private readonly IWebHostEnvironment _env;

    public ExtractController(
        IDocumentService docService,
        IDocumentWorkflowService workflowService,
        IFormCellRepository cellRepo,
        IUserRepository userRepo,
        IDocumentFormViewModelBuilder formBuilder,
        ILogger<ExtractController> logger,
        IWebHostEnvironment env)
    {
        _docService = docService;
        _workflowService = workflowService;
        _cellRepo = cellRepo;
        _userRepo = userRepo;
        _formBuilder = formBuilder;
        _logger = logger;
        _env = env;
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
        try
        {
            var vm = await _formBuilder.BuildForExtractAsync(id);
            return View(vm);
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    // POST /extract/submit
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Submit([FromBody] ExtractRequest? req)
    {
        if (req is null || req.DocumentId <= 0)
            return JsonResult(ApiResult.Fail("Thiếu dữ liệu gửi lên (documentId)."));

        try
        {
            var result = await _workflowService.SubmitExtractAsync(req, CurrentUser);
            return JsonResult(result);
        }
        catch (Exception ex)
        {
            var corr = HttpContext.TraceIdentifier;
            var userId = 0;
            try { userId = CurrentUser.Id; } catch { /* ignore */ }

            _logger.LogError(ex,
                "Extract Submit failed. DocumentId={DocumentId}, UserId={UserId}, CorrelationId={CorrelationId}",
                req.DocumentId, userId, corr);

            var detail = FormatExtractSubmitExceptionForClient(ex, _env, corr);
            return JsonResult(ApiResult.Fail(detail));
        }
    }

    /// <summary>
    /// Log đã có stack đầy đủ; chuỗi trả về client giúp tra cứu nhanh (CorrelationId + lỗi SQL nếu có).
    /// </summary>
    private static string FormatExtractSubmitExceptionForClient(Exception ex, IWebHostEnvironment env, string correlationId)
    {
        var sql = FindSqlException(ex);
        var sb = new StringBuilder();

        if (env.IsDevelopment())
        {
            sb.AppendLine(ex.GetType().Name + ": " + ex.Message);
            for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
                sb.AppendLine("↳ " + inner.GetType().Name + ": " + inner.Message);
            if (sql is not null)
                sb.AppendLine($"SQL #{sql.Number}, State={sql.State}, Class={sql.Class}, Procedure={sql.Procedure}, Line={sql.LineNumber}");
        }
        else
        {
            if (sql is not null)
            {
                sb.Append($"Lỗi SQL Server (#{sql.Number}): {sql.Message}");
                sb.Append($" | Mã tham chiếu: {correlationId}");
                return sb.ToString();
            }

            if (ex is InvalidOperationException iop && !string.IsNullOrWhiteSpace(iop.Message))
            {
                sb.Append(iop.Message);
                sb.Append($" | Mã tham chiếu: {correlationId}");
                return sb.ToString();
            }

            sb.Append($"Lỗi khi lưu nhập liệu. Mã tham chiếu: {correlationId}. ");
            sb.Append("Tra log server theo CorrelationId hoặc DocumentId; kiểm tra CSDL và quyền ghi stg_documents, stg_form_cells, log_action_logs.");
        }

        sb.AppendLine();
        sb.Append("(CorrelationId: ");
        sb.Append(correlationId);
        sb.Append(')');
        return sb.ToString().Trim();
    }

    private static SqlException? FindSqlException(Exception? ex)
    {
        while (ex is not null)
        {
            if (ex is SqlException se)
                return se;
            ex = ex.InnerException;
        }

        return null;
    }
}
