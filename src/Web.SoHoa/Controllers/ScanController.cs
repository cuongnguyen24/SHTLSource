using Core.Application.Services;
using Core.Domain.Contracts;
using Core.Domain.Enums;
using Infrastructure.Identity;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Shared.Contracts.Dtos;
using System.IO;

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
    private readonly IStorageService _storage;
    private readonly IWebHostEnvironment _env;
    private readonly IOptions<StorageOptions> _storageOpts;
    private readonly ILogger<ScanController> _logger;

    public ScanController(
        IDocumentService docService,
        IDocumentWorkflowService workflowService,
        IStorageService storage,
        IWebHostEnvironment env,
        IOptions<StorageOptions> storageOpts,
        ILogger<ScanController> logger)
    {
        _docService = docService;
        _workflowService = workflowService;
        _storage = storage;
        _env = env;
        _storageOpts = storageOpts;
        _logger = logger;
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

    /// <summary>Xóa mềm bản ghi + xóa file/thumbnail trên storage (chỉ khi chưa qua bước Extract).</summary>
    [HttpPost("/scan/delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete([FromForm] long id)
    {
        var result = await _workflowService.SafeDeleteAsync(id, CurrentUser);
        return JsonResult(result);
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

    /// <summary>Trang xem PDF (toolbar + iframe/object), tương tự AXE scanner form.</summary>
    [HttpGet("/scan/preview/{id:long}")]
    public async Task<IActionResult> Preview(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        return View(doc);
    }

    /// <summary>Stream PDF inline (dùng trong iframe). Không đặt tên action là File để tránh trùng Controller.File().</summary>
    [HttpGet("/scan/pdf/{id:long}")]
    public async Task<IActionResult> Pdf(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null)
        {
            _logger.LogWarning("Scan Pdf id={Id}: không có tài liệu (sai kênh hoặc không tồn tại)", id);
            return PdfNotFound("Tài liệu không tồn tại hoặc không thuộc kênh hiện tại.");
        }

        if (!IsPdf(doc) || string.IsNullOrWhiteSpace(doc.FilePath))
        {
            _logger.LogWarning(
                "Scan Pdf id={Id}: không phải PDF hoặc thiếu FilePath (Extension={Ext}, Name={Name})",
                id, doc.Extension, doc.Name);
            return PdfNotFound("Không phải PDF hoặc chưa có FilePath trong cơ sở dữ liệu.");
        }

        var stream = _storage.OpenRead(doc.FilePath) ?? TryOpenPdfStreamFallback(doc.FilePath);
        if (stream is null)
        {
            _logger.LogWarning(
                "Scan Pdf id={Id}: không đọc được file. FilePath={FilePath}, Storage:RootPath={Root}",
                id, doc.FilePath, _storageOpts.Value.RootPath);
            return PdfNotFound(
                $"File không có trên đĩa hoặc path không hợp lệ.\nFilePath (DB): {doc.FilePath}\nStorage:RootPath: {_storageOpts.Value.RootPath}");
        }

        return File(stream, "application/pdf", enableRangeProcessing: true);
    }

    /// <summary>404: production chỉ báo chung; Development trả text để dễ xử lý.</summary>
    private IActionResult PdfNotFound(string detail)
    {
        if (_env.IsDevelopment())
        {
            return new ContentResult
            {
                StatusCode = StatusCodes.Status404NotFound,
                ContentType = "text/plain; charset=utf-8",
                Content = "404 — Không phát được PDF\n\n" + detail
            };
        }

        // Trả detail dạng text để dễ kiểm tra ngay trên môi trường chạy thật.
        return new ContentResult
        {
            StatusCode = StatusCodes.Status404NotFound,
            ContentType = "text/plain; charset=utf-8",
            Content = "404 — Không phát được PDF\n\n" + detail
        };
    }

    private Stream? TryOpenPdfStreamFallback(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return null;

        var cleanRel = relativePath.TrimStart('/', '\\')
            .Replace('/', Path.DirectorySeparatorChar)
            .Replace('\\', Path.DirectorySeparatorChar);

        var roots = new[]
        {
            _storageOpts.Value.RootPath,
            @"E:\SHTL\Files",
            @"E:\SHTL\Storage\Files"
        };

        foreach (var root in roots.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                var baseRoot = Path.GetFullPath(root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                var full = Path.GetFullPath(Path.Combine(baseRoot, cleanRel));
                if (!full.StartsWith(baseRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(full, baseRoot, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!System.IO.File.Exists(full))
                    continue;
                return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read);
            }
            catch
            {
                // ignore and try next root
            }
        }

        return null;
    }

    [HttpGet("/scan/download/{id:long}")]
    public async Task<IActionResult> Download(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null || !IsPdf(doc) || string.IsNullOrWhiteSpace(doc.FilePath))
            return NotFound();

        var stream = _storage.OpenRead(doc.FilePath);
        if (stream is null) return NotFound();

        var downloadName = string.IsNullOrWhiteSpace(doc.FileName) ? $"tai-lieu-{id}.pdf" : doc.FileName;
        return File(stream, "application/pdf", fileDownloadName: downloadName);
    }

    private static bool IsPdf(DocumentDto doc)
    {
        var ext = (doc.Extension ?? "").Trim().TrimStart('.').ToLowerInvariant();
        if (ext == "pdf") return true;
        if (doc.Name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.IsNullOrEmpty(doc.FileName) && doc.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return true;
        // DB đôi khi chỉ có tên hiển thị (vd. "102") nhưng file thực tế là .pdf — AXE dựa vào path
        if (!string.IsNullOrEmpty(doc.FilePath) && doc.FilePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }

    private static DateTime? ParseDate(string? s)
        => DateTime.TryParse(s, out var d) ? d : null;
}
