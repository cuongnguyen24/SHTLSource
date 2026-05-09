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

    /// <summary>
    /// AXE: <c>FieldFolderN_Field</c> = tên cột trên bản ghi (Field1…), <c>fieldFoldersN</c> = giá trị lọc tùy chọn.
    /// </summary>
    private static string? BuildExportInputJson(
        CreateExportJobForm form,
        IReadOnlyList<ExportSyncFolderFieldInfo> syncFolderFields)
    {
        var d = new Dictionary<string, object?>();
        for (var i = 0; i < syncFolderFields.Count && i < 10; i++)
            d[$"FieldFolder{i + 1}_Field"] = syncFolderFields[i].FieldName;

        for (var i = 0; i < form.FolderFields.Count && i < 10; i++)
        {
            var v = form.FolderFields[i]?.Trim();
            if (string.IsNullOrEmpty(v))
                continue;
            d[$"fieldFolders{i + 1}"] = new[] { v };
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

    private static int CountFieldFolderExportLevel(CreateExportJobForm form, int syncFolderLevelCount)
    {
        var filterFilled = 0;
        for (var i = 0; i < form.FolderFields.Count && i < 10; i++)
        {
            if (!string.IsNullOrWhiteSpace(form.FolderFields[i]))
                filterFilled++;
        }

        if (syncFolderLevelCount > 0)
            return Math.Max(syncFolderLevelCount, filterFilled);
        return filterFilled;
    }

    private static string? ExtractFirstFieldFolderFilterValue(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Array)
        {
            foreach (var x in el.EnumerateArray())
            {
                var s = x.ValueKind == JsonValueKind.String ? x.GetString() : x.ToString();
                if (!string.IsNullOrWhiteSpace(s))
                    return s.Trim();
            }

            return null;
        }

        if (el.ValueKind == JsonValueKind.String)
            return el.GetString()?.Trim();
        return el.ToString();
    }

    private static List<string> ParseFieldFolderFiltersFromJson(JsonElement root)
    {
        var list = new List<string>();
        for (var i = 1; i <= 10; i++)
        {
            if (!root.TryGetProperty($"fieldFolders{i}", out var el))
            {
                list.Add("");
                continue;
            }

            list.Add(ExtractFirstFieldFolderFilterValue(el) ?? "");
        }

        while (list.Count > 0 && string.IsNullOrWhiteSpace(list[^1]))
            list.RemoveAt(list.Count - 1);

        return list;
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
                form.FolderFields = ParseFieldFolderFiltersFromJson(root);

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
        var syncFolderFields = form.SyncTypeId is > 0
            ? await _syncTypeRepo.GetExportFolderFieldsForJobAsync(form.SyncTypeId.Value)
            : Array.Empty<ExportSyncFolderFieldInfo>();
        if (form.SyncTypeId is > 0 && syncFolderFields.Count == 0)
        {
            ModelState.AddModelError(nameof(form.SyncTypeId),
                "Loại đồng bộ không suy ra được cấp thư mục: Title trong stg_doc_type_sync_settings phải xuất hiện trong Format; id_field phải khớp stg_doc_fields (hoặc 101–125 → Field1–Field25).");
        }

        if (!ModelState.IsValid)
        {
            await LoadFormLookupsAsync();
            return View(form);
        }

        var levels = CountFieldFolderExportLevel(form, syncFolderFields.Count);
        var job = new ExportJob
        {
            ExportTypeId = form.ExportTypeId,
            Name = form.Name.Trim(),
            FilterJson = BuildFilterJson(form),
            ExportInputJson = BuildExportInputJson(form, syncFolderFields),
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

        var syncFolderFields = form.SyncTypeId is > 0
            ? await _syncTypeRepo.GetExportFolderFieldsForJobAsync(form.SyncTypeId.Value)
            : Array.Empty<ExportSyncFolderFieldInfo>();
        if (form.SyncTypeId is > 0 && syncFolderFields.Count == 0)
        {
            ModelState.AddModelError(nameof(form.SyncTypeId),
                "Loại đồng bộ không suy ra được cấp thư mục: Title trong stg_doc_type_sync_settings phải xuất hiện trong Format; id_field phải khớp stg_doc_fields (hoặc 101–125 → Field1–Field25).");
        }

        if (!ModelState.IsValid)
        {
            await LoadFormLookupsAsync();
            return View(form);
        }

        var levels = CountFieldFolderExportLevel(form, syncFolderFields.Count);
        existing.ExportTypeId = form.ExportTypeId;
        existing.Name = form.Name.Trim();
        existing.FilterJson = BuildFilterJson(form);
        existing.ExportInputJson = BuildExportInputJson(form, syncFolderFields);
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
        var rows = await _syncTypeRepo.GetExportFolderFieldsForJobAsync(id);
        var fields = rows
            .Select(r => new
            {
                title = string.IsNullOrWhiteSpace(r.Title) ? $"Cấp {r.Weight}" : r.Title,
                field = r.FieldName,
                weight = r.Weight
            })
            .ToList();
        return Json(new { success = fields.Count > 0, fields });
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
        var mime = path.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)
            ? "application/zip"
            : "application/octet-stream";
        return PhysicalFile(path, mime, name);
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
