using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Features.Admin.Models;
using SHTL.Modules.Features.Shared;
using SHTL.Modules.Features.SoHoa.Services;
using SHTL.Modules.Infrastructure.Identity;

namespace SHTL.Modules.Features.SoHoa.Controllers;

/// <summary>Quản lý loại xuất + upload Excel → JsonConfig (AXE: ExportType trong SoHoa).</summary>
[Authorize]
[AuthorizeModule(ModuleCode.ExportConfig)]
[Route("sohoa/loai-xuat")]
public class ExportTypeController : BaseController
{
    private readonly IExportTypeRepository _exportTypeRepo;
    private readonly IStorageService _storage;
    private readonly ExcelToJsonConverter _excelConverter;
    private readonly ILogger<ExportTypeController> _logger;

    public ExportTypeController(
        IExportTypeRepository exportTypeRepo,
        IStorageService storage,
        ExcelToJsonConverter excelConverter,
        ILogger<ExportTypeController> logger)
    {
        _exportTypeRepo = exportTypeRepo;
        _storage = storage;
        _excelConverter = excelConverter;
        _logger = logger;
    }

    private void SetLoaiXuatHeader(string title, string icon, params BreadcrumbItem[] crumbs)
    {
        ViewData["Title"] = title;
        ViewData["PageTitle"] = title;
        ViewData["PageIcon"] = icon;
        ViewData["Breadcrumbs"] = crumbs.Length > 0
            ? crumbs.ToList()
            : new List<BreadcrumbItem>
            {
                new() { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) }
            };
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(string? search)
    {
        var exportTypes = string.IsNullOrEmpty(search)
            ? await _exportTypeRepo.GetListedAsync()
            : await _exportTypeRepo.SearchAsync(search ?? "");

        ViewBag.Search = search;
        SetLoaiXuatHeader("Loại xuất dữ liệu", "file-export",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) },
            new BreadcrumbItem { Text = "Cấu hình loại xuất" });
        ViewData["SearchQuery"] = search;
        ViewData["SearchPlaceholder"] = "Tìm theo tên, mã...";
        ViewData["PrimaryButtonText"] = "Tạo mới";
        ViewData["PrimaryButtonUrl"] = Url.Action("Create", "ExportType", new { area = "sohoa" });

        return View(exportTypes);
    }

    [HttpGet("create")]
    public IActionResult Create()
    {
        SetLoaiXuatHeader("Tạo loại xuất", "plus-circle",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) },
            new BreadcrumbItem { Text = "Loại xuất", Url = Url.Action("Index", "ExportType", new { area = "sohoa" }) },
            new BreadcrumbItem { Text = "Tạo mới" });

        return View(new CreateExportTypeRequest());
    }

    [HttpPost("create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateExportTypeRequest model, IFormFile? excelFile)
    {
        void headerError()
        {
            SetLoaiXuatHeader("Tạo loại xuất", "plus-circle",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) },
                new BreadcrumbItem { Text = "Loại xuất", Url = Url.Action("Index", "ExportType", new { area = "sohoa" }) },
                new BreadcrumbItem { Text = "Tạo mới" });
        }

        if (!ModelState.IsValid)
        {
            headerError();
            return View(model);
        }

        if (await _exportTypeRepo.IsCodeExistsAsync(model.Code))
        {
            SetError("Mã loại xuất đã tồn tại");
            headerError();
            return View(model);
        }

        var exportType = new ExportType
        {
            Name = model.Name,
            Code = model.Code,
            Description = model.Description,
            IsActive = true,
            Created = DateTime.UtcNow,
            CreatedBy = CurrentUser.Id,
            SearchMeta = $"{model.Name} {model.Code} {model.Description}".ToLower()
        };

        if (excelFile != null && excelFile.Length > 0)
        {
            var ext = Path.GetExtension(excelFile.FileName).ToLower();
            if (ext != ".xlsx" && ext != ".xls")
            {
                SetError("Chỉ chấp nhận file Excel (.xlsx, .xls)");
                headerError();
                return View(model);
            }

            try
            {
                var subPath = "export-configs";
                var fileName = $"{model.Code}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";

                await using (var stream = excelFile.OpenReadStream())
                {
                    var filePath = await _storage.SaveFileAsync(stream, fileName, subPath);
                    exportType.ExcelFilePath = filePath;
                }

                exportType.ExcelFileName = excelFile.FileName;

                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{ext}");
                await using (var fileStream = System.IO.File.Create(tempPath))
                {
                    await excelFile.CopyToAsync(fileStream);
                }

                exportType.JsonConfig = await _excelConverter.ConvertAsync(tempPath, model.Code);

                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Excel file");
                SetError($"Lỗi xử lý file Excel: {ex.Message}");
                headerError();
                return View(model);
            }
        }

        var id = await _exportTypeRepo.InsertAsync(exportType);
        if (id > 0)
        {
            SetSuccess("Tạo loại xuất dữ liệu thành công");
            return RedirectToAction(nameof(Index));
        }

        SetError("Tạo loại xuất dữ liệu thất bại");
        headerError();
        return View(model);
    }

    [HttpGet("edit")]
    public async Task<IActionResult> Edit(int id)
    {
        var exportType = await _exportTypeRepo.GetByIdAsync(id);
        if (exportType == null)
        {
            SetError("Không tìm thấy loại xuất dữ liệu");
            return RedirectToAction(nameof(Index));
        }

        SetLoaiXuatHeader("Sửa loại xuất", "edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) },
            new BreadcrumbItem { Text = "Loại xuất", Url = Url.Action("Index", "ExportType", new { area = "sohoa" }) },
            new BreadcrumbItem { Text = "Sửa" });

        var model = new UpdateExportTypeRequest
        {
            Id = exportType.Id,
            Name = exportType.Name,
            Code = exportType.Code,
            Description = exportType.Description,
            IsActive = exportType.IsActive,
            ExcelFileName = exportType.ExcelFileName,
            JsonConfig = exportType.JsonConfig
        };

        return View(model);
    }

    [HttpPost("edit")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(UpdateExportTypeRequest model, IFormFile? excelFile)
    {
        void headerEdit()
        {
            SetLoaiXuatHeader("Sửa loại xuất", "edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home", new { area = "sohoa" }) },
                new BreadcrumbItem { Text = "Loại xuất", Url = Url.Action("Index", "ExportType", new { area = "sohoa" }) },
                new BreadcrumbItem { Text = "Sửa" });
        }

        if (!ModelState.IsValid)
        {
            headerEdit();
            return View(model);
        }

        var exportType = await _exportTypeRepo.GetByIdAsync(model.Id);
        if (exportType == null)
        {
            SetError("Không tìm thấy loại xuất dữ liệu");
            return RedirectToAction(nameof(Index));
        }

        if (await _exportTypeRepo.IsCodeExistsAsync(model.Code, model.Id))
        {
            SetError("Mã loại xuất đã tồn tại");
            headerEdit();
            return View(model);
        }

        exportType.Name = model.Name;
        exportType.Code = model.Code;
        exportType.Description = model.Description;
        exportType.IsActive = model.IsActive;
        exportType.Updated = DateTime.UtcNow;
        exportType.UpdatedBy = CurrentUser.Id;
        exportType.SearchMeta = $"{model.Name} {model.Code} {model.Description}".ToLower();

        if (excelFile != null && excelFile.Length > 0)
        {
            var ext = Path.GetExtension(excelFile.FileName).ToLower();
            if (ext != ".xlsx" && ext != ".xls")
            {
                SetError("Chỉ chấp nhận file Excel (.xlsx, .xls)");
                headerEdit();
                return View(model);
            }

            try
            {
                var subPath = "export-configs";
                var fileName = $"{model.Code}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";

                await using (var stream = excelFile.OpenReadStream())
                {
                    var filePath = await _storage.SaveFileAsync(stream, fileName, subPath);
                    exportType.ExcelFilePath = filePath;
                }

                exportType.ExcelFileName = excelFile.FileName;

                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{ext}");
                await using (var fileStream = System.IO.File.Create(tempPath))
                {
                    await excelFile.CopyToAsync(fileStream);
                }

                exportType.JsonConfig = await _excelConverter.ConvertAsync(tempPath, model.Code);

                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Excel file");
                SetError($"Lỗi xử lý file Excel: {ex.Message}");
                headerEdit();
                return View(model);
            }
        }

        var result = await _exportTypeRepo.UpdateAsync(exportType);
        if (result > 0)
        {
            SetSuccess("Cập nhật loại xuất dữ liệu thành công");
            return RedirectToAction(nameof(Index));
        }

        SetError("Cập nhật loại xuất dữ liệu thất bại");
        headerEdit();
        return View(model);
    }

    [HttpPost("delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var exportType = await _exportTypeRepo.GetByIdAsync(id);
        if (exportType == null)
            return Json(new { success = false, message = "Không tìm thấy loại xuất dữ liệu" });

        var result = await _exportTypeRepo.DeleteAsync(id);
        if (result > 0)
            return Json(new { success = true, message = "Xóa loại xuất dữ liệu thành công" });

        return Json(new { success = false, message = "Xóa loại xuất dữ liệu thất bại" });
    }
}
