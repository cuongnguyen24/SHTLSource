using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.SoHoa.Controllers;

/// <summary>
/// Quản lý danh sách tài liệu scan/upload và các thao tác trên bước scan.
/// </summary>
[Authorize]
public class ScanController : BaseController
{
    private readonly IDocumentService _docService;
    private readonly IDocumentWorkflowService _workflowService;
    private readonly IStorageService _storage;
    private readonly IWebHostEnvironment _env;
    private readonly IOptions<StorageOptions> _storageOpts;
    private readonly ICnfRepository _cnfRepo;
    private readonly ILogger<ScanController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IAxeSyncTypeRepository _syncTypeRepository;

    public ScanController(
        IDocumentService docService,
        IDocumentWorkflowService workflowService,
        IStorageService storage,
        IWebHostEnvironment env,
        IOptions<StorageOptions> storageOpts,
        ICnfRepository cnfRepo,
        ILogger<ScanController> logger,
        IConfiguration configuration,
        IAxeSyncTypeRepository syncTypeRepository)
    {
        _docService = docService;
        _workflowService = workflowService;
        _storage = storage;
        _env = env;
        _storageOpts = storageOpts;
        _cnfRepo = cnfRepo;
        _logger = logger;
        _configuration = configuration;
        _syncTypeRepository = syncTypeRepository;
    }

    // GET /scan - Danh sách tài liệu mới upload
    [HttpGet]
    [AuthorizeModule(ModuleCode.ScanUpload)]
    public async Task<IActionResult> Index()
    {
        int? docTypeId = null;
        if (int.TryParse(Request.Query["docTypeId"], out var parsedDocTypeId) && parsedDocTypeId > 0)
            docTypeId = parsedDocTypeId;

        var req = new DocumentFilterRequest
        {
            PageIndex = GetPageRequest().PageIndex,
            PageSize = GetPageRequest().PageSize,
            Search = Request.Query["q"],
            StartDate = ParseDate(Request.Query["from"]),
            EndDate = ParseDate(Request.Query["to"]),
            DocTypeId = docTypeId
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        ViewBag.Request = req;
        return View(result);
    }

    /// <summary>Xóa mềm bản ghi + xóa file/thumbnail trên storage (chỉ khi chưa qua bước Extract).</summary>
    [HttpPost("/scan/delete")]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.ScanUpload)]
    public async Task<IActionResult> Delete([FromForm] long id)
    {
        var result = await _workflowService.SafeDeleteAsync(id, CurrentUser);
        return JsonResult(result);
    }

    /// <summary>Từ danh sách upload: đưa bản ghi đang Extract vào hàng đợi Scan (kiểm tra scan 1).</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.ScanUpload)]
    public async Task<IActionResult> QueueForCheckScan1([FromForm] long id)
    {
        var result = await _workflowService.QueueExtractForScanCheck1Async(id, CurrentUser);
        return JsonResult(result);
    }

    // GET /scan/check-scan1 - Danh sách chờ kiểm tra scan lần 1
    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckScanFirst)]
    public async Task<IActionResult> CheckScan1List()
    {
        var pr = GetPageRequest();
        var search = Request.Query["q"].ToString().Trim();
        var req = new DocumentFilterRequest
        {
            PageIndex = pr.PageIndex,
            PageSize = pr.PageSize,
            Search = string.IsNullOrEmpty(search) ? null : search,
            ForScanCheck1Board = true
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        ViewBag.Search = search;
        return View("CheckScan1", result);
    }

    // POST /scan/do-check-scan1
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckScanFirst)]
    public async Task<IActionResult> DoCheckScan1([FromBody] CheckScanRequest req)
    {
        var result = await _workflowService.CheckScan1Async(req, CurrentUser);
        if (!result.Success)
            return JsonResult(result);
        var nextId = await _docService.GetNextScanCheck1QueueIdAfterAsync(req.DocumentId, search: null);
        var nextPreviewUrl = nextId.HasValue ? Url.Content($"~/scan/preview/{nextId.Value}") : null;
        return Json(new { success = true, message = result.Message, errors = result.Errors, nextPreviewUrl });
    }

    // GET /scan/check-scan2
    [HttpGet]
    [AuthorizeModule(ModuleCode.CheckScanSecond)]
    public async Task<IActionResult> CheckScan2List()
    {
        var pr = GetPageRequest();
        var search = Request.Query["q"].ToString().Trim();
        var req = new DocumentFilterRequest
        {
            PageIndex = pr.PageIndex,
            PageSize = pr.PageSize,
            Search = string.IsNullOrEmpty(search) ? null : search,
            Step = WorkflowStep.CheckScan2
        };
        var result = await _docService.GetListAsync(req, CurrentUser);
        ViewBag.Search = search;
        return View("CheckScan2", result);
    }

    // POST /scan/do-check-scan2
    [HttpPost]
    [ValidateAntiForgeryToken]
    [AuthorizeModule(ModuleCode.CheckScanSecond)]
    public async Task<IActionResult> DoCheckScan2([FromBody] CheckScanRequest req)
    {
        var result = await _workflowService.CheckScan2Async(req, CurrentUser);
        if (!result.Success)
            return JsonResult(result);
        var nextId = await _docService.GetNextScanCheck2QueueIdAfterAsync(req.DocumentId, search: null);
        var nextPreviewUrl = nextId.HasValue ? Url.Content($"~/scan/preview/{nextId.Value}") : null;
        return Json(new { success = true, message = result.Message, errors = result.Errors, nextPreviewUrl });
    }

    // GET /scan/detail/{id}
    [HttpGet]
    [AuthorizeModule(ModuleCode.ScanUpload, ModuleCode.CheckScanFirst, ModuleCode.CheckScanSecond)]
    public async Task<IActionResult> Detail(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();
        return View(doc);
    }

    /// <summary>Trang xem PDF (toolbar + iframe/object), tương tự AXE scanner form.</summary>
    [HttpGet("/scan/preview/{id:long}")]
    [AuthorizeModule(
        ModuleCode.ScanUpload,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm)]
    public async Task<IActionResult> Preview(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null) return NotFound();

        // Nút Đạt / Từ chối: scan 1 (kể cả Extract khi bật IsCheckFirstScan), scan 2. POST vẫn [AuthorizeModule].
        var firstScanOn = await WorkflowUploadInitialStep.IsCheckFirstScanEnabledAsync(_cnfRepo, HttpContext.RequestAborted);
        var kind = 0;
        if (doc.CurrentStep == WorkflowStep.Scan || doc.CurrentStep == WorkflowStep.CheckScan1
            || (firstScanOn && doc.CurrentStep == WorkflowStep.Extract))
            kind = 1;
        else if (doc.CurrentStep == WorkflowStep.CheckScan2)
            kind = 2;

        var canAct = kind switch
        {
            1 => UserHasModulePermission(CurrentUser, ModuleCode.CheckScanFirst),
            2 => UserHasModulePermission(CurrentUser, ModuleCode.CheckScanSecond),
            _ => false
        };

        ViewData["PreviewCheckScanKind"] = kind;
        ViewData["PreviewCheckScanCanAct"] = canAct;

        return View(doc);
    }

    /// <summary>Cùng logic claim với <see cref="AuthorizeModuleAttribute"/>.</summary>
    private static bool UserHasModulePermission(ICurrentUser user, ModuleCode module)
    {
        if (user.IsAdmin) return true;
        var name = module.ToString();
        var numeric = ((int)module).ToString(CultureInfo.InvariantCulture);
        return user.HasPermission(name) || user.HasPermission(numeric);
    }

    /// <summary>Stream PDF inline (dùng trong iframe). Không đặt tên action là File để tránh trùng Controller.File().</summary>
    [HttpGet("/scan/pdf/{id:long}")]
    [AuthorizeModule(
        ModuleCode.ScanUpload,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm)]
    public async Task<IActionResult> Pdf(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        if (doc is null)
        {
            _logger.LogWarning("Scan Pdf id={Id}: không có tài liệu (sai kênh hoặc không tồn tại)", id);
            return PdfNotFound("Tài liệu không tồn tại hoặc không thuộc kênh hiện tại.");
        }

        var pdfRel = ResolvePdfStoragePath(doc);
        if (!IsPdf(doc) || string.IsNullOrWhiteSpace(pdfRel))
        {
            _logger.LogWarning(
                "Scan Pdf id={Id}: không phải PDF hoặc thiếu đường dẫn file (Extension={Ext}, Name={Name})",
                id, doc.Extension, doc.Name);
            return PdfNotFound("Không phải PDF hoặc chưa có FilePath trong cơ sở dữ liệu.");
        }

        var stream = _storage.OpenRead(pdfRel) ?? TryOpenPdfStreamFallback(pdfRel);
        if (stream is null)
        {
            _logger.LogWarning(
                "Scan Pdf id={Id}: không đọc được file. Path={Path}, Storage:RootPath={Root}",
                id, pdfRel, _storageOpts.Value.RootPath);
            return PdfNotFound(
                $"File không có trên đĩa hoặc path không hợp lệ.\nPath (DB): {pdfRel}\nStorage:RootPath: {_storageOpts.Value.RootPath}");
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
    [AuthorizeModule(
        ModuleCode.ScanUpload,
        ModuleCode.CheckScanFirst,
        ModuleCode.CheckScanSecond,
        ModuleCode.ExtractDigit,
        ModuleCode.ExtractAlphabet,
        ModuleCode.ExtractCharacter,
        ModuleCode.ExtractTick,
        ModuleCode.ExtractForm)]
    public async Task<IActionResult> Download(long id)
    {
        var doc = await _docService.GetByIdAsync(id, CurrentUser);
        var pdfRel = doc is null ? null : ResolvePdfStoragePath(doc);
        if (doc is null || !IsPdf(doc) || string.IsNullOrWhiteSpace(pdfRel))
            return NotFound();

        var stream = _storage.OpenRead(pdfRel);
        if (stream is null) return NotFound();

        var downloadName = string.IsNullOrWhiteSpace(doc.FileName) ? $"tai-lieu-{id}.pdf" : doc.FileName;
        return File(stream, "application/pdf", fileDownloadName: downloadName);
    }

    /// <summary>Ưu tiên PDF 2 lớp (PathPdfSearchable) nếu file tồn tại trên storage.</summary>
    private string? ResolvePdfStoragePath(DocumentDto doc)
    {
        if (!IsPdf(doc)) return null;
        if (!string.IsNullOrWhiteSpace(doc.PathPdfSearchable))
        {
            var probe = _storage.OpenRead(doc.PathPdfSearchable);
            if (probe is not null)
            {
                probe.Dispose();
                return doc.PathPdfSearchable;
            }
        }

        return string.IsNullOrWhiteSpace(doc.FilePath) ? null : doc.FilePath;
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

    [HttpGet("/sohoa/scan/plugin-sync-status")]
    [AuthorizeModule(ModuleCode.ScanUpload)]
    public async Task<IActionResult> PluginSyncStatus(CancellationToken cancellationToken)
    {
        var enabled = _configuration.GetValue<bool?>("PluginSync:Enabled") ?? false;
        var launchUrl = _configuration["PluginSync:LaunchUrl"] ?? "http://127.0.0.1:18181/activate";
        var healthUrl = _configuration["PluginSync:HealthUrl"] ?? "http://127.0.0.1:18181/health";
        var timeoutMs = _configuration.GetValue<int?>("PluginSync:HealthTimeoutMs") ?? 1500;

        if (!enabled)
            return Json(new { enabled = false, online = false, activateUrl = launchUrl, message = "Plugin đồng bộ đang tắt. Vui lòng bật PluginSync:Enabled." });

        var online = false;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMilliseconds(Math.Max(500, timeoutMs)) };
            using var resp = await http.GetAsync(healthUrl, cancellationToken);
            online = resp.IsSuccessStatusCode;
        }
        catch
        {
            online = false;
        }

        return Json(new { enabled = true, online, activateUrl = launchUrl });
    }

    [HttpGet("/sohoa/scan/plugin-sync-config")]
    [AuthorizeModule(ModuleCode.ScanUpload)]
    public async Task<IActionResult> PluginSyncConfig(CancellationToken cancellationToken)
    {
        var syncTypes = await _syncTypeRepository.ListAsync(null);
        var items = new List<object>(syncTypes.Count);
        foreach (var sync in syncTypes.OrderBy(x => x.Weight).ThenBy(x => x.Name))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var settings = await _syncTypeRepository.GetSettingsAsync(sync.Id);
            items.Add(new
            {
                syncTypeId = sync.Id,
                docTypeId = sync.DocTypeId,
                docTypeName = sync.DocTypeName,
                name = sync.Name,
                describe = sync.Describe,
                format = sync.Format,
                scanPathRoot = sync.ScanPathRoot,
                weight = sync.Weight,
                isDefault = sync.IsDefault,
                settings = settings
                    .OrderBy(s => s.Weight)
                    .Select(s => new
                    {
                        id = s.Id,
                        idField = s.IdField,
                        title = s.Title,
                        weight = s.Weight,
                        isRequired = s.IsRequired
                    })
            });
        }

        return Json(new
        {
            uploadUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/upload/plugin-sync",
            uploadChunkUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/upload/plugin-sync-chunk",
            apiKey = _configuration["Uploader:ApiKey"] ?? string.Empty,
            createdBy = CurrentUser.Id,
            items
        });
    }
}
