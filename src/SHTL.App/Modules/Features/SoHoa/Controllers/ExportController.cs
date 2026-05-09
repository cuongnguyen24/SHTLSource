using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Exporting;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Features.SoHoa.Models;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Identity;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Features.SoHoa.Controllers;

[Authorize]
[AuthorizeModule(ModuleCode.ExportData, ModuleCode.ExportConfig)]
public class ExportController : BaseController
{
    private readonly IExportJobRepository _exportRepo;
    private readonly IExportTypeRepository _exportTypeRepo;
    private readonly IAxeDocTypeRepository _docTypeRepo;
    private readonly IAxeSyncTypeRepository _syncTypeRepo;
    private readonly IDocumentWorkflowService _workflowService;

    public ExportController(
        IExportJobRepository exportRepo,
        IExportTypeRepository exportTypeRepo,
        IAxeDocTypeRepository docTypeRepo,
        IAxeSyncTypeRepository syncTypeRepo,
        IDocumentWorkflowService workflowService)
    {
        _exportRepo = exportRepo;
        _exportTypeRepo = exportTypeRepo;
        _docTypeRepo = docTypeRepo;
        _syncTypeRepo = syncTypeRepo;
        _workflowService = workflowService;
    }

    private async Task LoadFormLookupsAsync()
    {
        ViewBag.ExportTypes = await _exportTypeRepo.GetListedAsync();
        ViewBag.DocTypes = await _docTypeRepo.ListDocTypesBriefAsync();
        ViewBag.SyncTypes = await _syncTypeRepo.ListAsync(search: null);
    }

    private static DateTime? ParseLocalDateStartUtc(string? s)
    {
        if (string.IsNullOrWhiteSpace(s) || !DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return null;
        var local = DateTime.SpecifyKind(d.Date, DateTimeKind.Local);
        return local.ToUniversalTime();
    }

    private static DateTime? ParseLocalDateEndExclusiveUtc(string? s)
    {
        if (string.IsNullOrWhiteSpace(s) || !DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return null;
        var localEnd = DateTime.SpecifyKind(d.Date.AddDays(1), DateTimeKind.Local);
        return localEnd.ToUniversalTime();
    }

    private static string? BuildFilterJson(CreateExportJobForm form)
    {
        var d = new Dictionary<string, object?> { ["docStatus"] = form.DocStatus };
        if (form.DocTypeId is > 0)
            d["docTypeId"] = form.DocTypeId.Value;
        return JsonSerializer.Serialize(d, ExportJson.SerializeOptions);
    }

    private static string? BuildExportInputJson(CreateExportJobForm form)
    {
        var d = new Dictionary<string, object?>();
        for (var i = 0; i < form.FolderFields.Count && i < 10; i++)
        {
            var v = form.FolderFields[i]?.Trim();
            if (string.IsNullOrEmpty(v))
                continue;
            d[$"FieldFolder{i + 1}_Field"] = v;
        }

        if (form.DocTypeId is > 0)
        {
            d["doctypes"] = new[]
            {
                form.DocTypeId.Value.ToString(CultureInfo.InvariantCulture)
            };
        }

        if (form.SyncTypeId is > 0)
            d["syncTypeId"] = form.SyncTypeId.Value;

        if (!string.IsNullOrWhiteSpace(form.ThuMucXuat))
            d["thuMucXuat"] = form.ThuMucXuat.Trim();

        if (d.Count == 0)
            return null;
        return JsonSerializer.Serialize(d, ExportJson.SerializeOptions);
    }

    private static int CountFolderLevels(CreateExportJobForm form)
    {
        var n = 0;
        for (var i = 0; i < form.FolderFields.Count && i < 10; i++)
        {
            if (!string.IsNullOrWhiteSpace(form.FolderFields[i]))
                n++;
        }
        return n;
    }

    private static void MapJobToEditForm(ExportJob job, EditExportJobForm form)
    {
        form.Id = job.Id;
        form.Name = job.Name ?? "";
        form.ExportTypeId = job.ExportTypeId;
        form.DocStatus = job.DocStatus;
        form.IsExportFile = job.IsExportFile;
        form.FolderFields = new List<string>();

        if (!string.IsNullOrWhiteSpace(job.FilterJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(job.FilterJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("docTypeId", out var dt))
                {
                    if (dt.ValueKind == JsonValueKind.Number && dt.TryGetInt32(out var dti))
                        form.DocTypeId = dti;
                    else if (dt.ValueKind == JsonValueKind.String && int.TryParse(dt.GetString(), out var dtp))
                        form.DocTypeId = dtp;
                }
            }
            catch
            {
                // ignore
            }
        }

        if (!string.IsNullOrWhiteSpace(job.ExportInputJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(job.ExportInputJson);
                var root = doc.RootElement;
                for (var i = 1; i <= 10; i++)
                {
                    var key = $"FieldFolder{i}_Field";
                    if (!root.TryGetProperty(key, out var el))
                        continue;
                    var s = el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
                    if (!string.IsNullOrWhiteSpace(s))
                        form.FolderFields.Add(s.Trim());
                }

                if (root.TryGetProperty("syncTypeId", out var sid) && sid.ValueKind == JsonValueKind.Number &&
                    sid.TryGetInt32(out var st))
                    form.SyncTypeId = st;

                if (root.TryGetProperty("thuMucXuat", out var tm))
                    form.ThuMucXuat = tm.ValueKind == JsonValueKind.String ? tm.GetString() : tm.ToString();
            }
            catch
            {
                // ignore
            }
        }
    }

    [HttpGet]
    public async Task<IActionResult> Index(string? q, string? from, string? to, int? exportTypeId)
    {
        ViewBag.Search = q ?? "";
        ViewBag.From = from;
        ViewBag.To = to;
        ViewBag.ExportTypeId = exportTypeId;
        ViewBag.ExportTypes = await _exportTypeRepo.GetListedAsync();

        var fromUtc = ParseLocalDateStartUtc(from);
        var toExUtc = ParseLocalDateEndExclusiveUtc(to);
        var rows = await _exportRepo.SearchAsync(q, fromUtc, toExUtc, exportTypeId);
        return View(rows);
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        await LoadFormLookupsAsync();
        return View(new CreateExportJobForm());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateExportJobForm form)
    {
        if (!ModelState.IsValid)
        {
            await LoadFormLookupsAsync();
            return View(form);
        }

        var levels = CountFolderLevels(form);
        var job = new ExportJob
        {
            ExportTypeId = form.ExportTypeId,
            Name = form.Name.Trim(),
            FilterJson = BuildFilterJson(form),
            ExportInputJson = BuildExportInputJson(form),
            FieldFolderExport = levels,
            DocStatus = form.DocStatus,
            IsExportFile = form.IsExportFile,
            Status = QueueStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            RequestedBy = CurrentUser.Id,
            Total = 0,
            Processed = 0,
            Success = 0,
            Error = 0,
            CompressedPercent = 0
        };

        await _exportRepo.EnqueueAsync(job);
        SetSuccess("Đã tạo lượt xuất.");
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(long id)
    {
        var job = await _exportRepo.GetByIdAsync(id);
        if (job is null)
            return NotFound();
        if (job.Status == QueueStatus.Processing)
        {
            SetWarning("Job đang xử lý, không sửa được.");
            return RedirectToAction(nameof(Index));
        }

        var form = new EditExportJobForm();
        MapJobToEditForm(job, form);
        await LoadFormLookupsAsync();
        return View(form);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(EditExportJobForm form)
    {
        if (!ModelState.IsValid)
        {
            await LoadFormLookupsAsync();
            return View(form);
        }

        var existing = await _exportRepo.GetByIdAsync(form.Id);
        if (existing is null)
            return NotFound();
        if (existing.Status == QueueStatus.Processing)
        {
            SetWarning("Job đang xử lý, không sửa được.");
            return RedirectToAction(nameof(Index));
        }

        var levels = CountFolderLevels(form);
        existing.ExportTypeId = form.ExportTypeId;
        existing.Name = form.Name.Trim();
        existing.FilterJson = BuildFilterJson(form);
        existing.ExportInputJson = BuildExportInputJson(form);
        existing.FieldFolderExport = levels;
        existing.DocStatus = form.DocStatus;
        existing.IsExportFile = form.IsExportFile;

        var n = await _exportRepo.UpdateEditableAsync(existing);
        if (n == 0)
        {
            SetError("Không cập nhật được (có thể job đang chạy).");
            await LoadFormLookupsAsync();
            return View(form);
        }

        SetSuccess("Đã lưu.");
        return RedirectToAction(nameof(Index));
    }

    /// <summary>API cho form: trả về các cấp thư mục theo cấu hình loại đồng bộ.</summary>
    [HttpGet]
    public async Task<IActionResult> SyncTypeFields(int id)
    {
        var settings = await _syncTypeRepo.GetSettingsAsync(id);
        var fields = settings
            .Select(s => new { title = string.IsNullOrWhiteSpace(s.Title) ? $"Cấp {s.Weight}" : s.Title })
            .ToList();
        return Json(new { success = true, fields });
    }

    [HttpGet]
    public async Task<IActionResult> Download(long id)
    {
        var job = await _exportRepo.GetByIdAsync(id);
        if (job is null || job.Status != QueueStatus.Done || string.IsNullOrWhiteSpace(job.DownloadPath))
            return NotFound();
        var path = job.DownloadPath;
        if (!System.IO.File.Exists(path))
        {
            SetError("File không còn trên máy chủ.");
            return RedirectToAction(nameof(Index));
        }

        var name = Path.GetFileName(path);
        return PhysicalFile(path, "application/octet-stream", name);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(long id)
    {
        var n = await _exportRepo.DeleteAsync(id);
        if (n == 0)
            return JsonFail("Không xóa được (job không tồn tại hoặc đang chạy).");
        return JsonOk("Đã xóa");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Rerun(long id)
    {
        var n = await _exportRepo.ResetToPendingAsync(id);
        if (n == 0)
            return JsonFail("Không chạy lại được (job không tồn tại hoặc đang xử lý).");
        return JsonOk("Đã đưa vào hàng đợi");
    }

    /// <summary>POST sohoa/Export/Request — xếp hàng export một tài liệu (workflow).</summary>
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
