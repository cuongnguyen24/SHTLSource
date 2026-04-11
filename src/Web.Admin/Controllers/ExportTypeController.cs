using Core.Application.Services;
using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Service.Export.Services;
using Shared.Contracts.Dtos;
using Web.Shared;
using Web.Admin.Models;

namespace Web.Admin.Controllers;

/// <summary>
/// Controller quản lý loại xuất dữ liệu (ExportType)
/// Port từ AXE: ExportTypeController
/// </summary>
public class ExportTypeController : BaseAdminController
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

    [HttpGet]
    public async Task<IActionResult> Index(string? search)
    {
        var exportTypes = string.IsNullOrEmpty(search)
            ? await _exportTypeRepo.GetByChannelAsync(ChannelId)
            : await _exportTypeRepo.SearchAsync(ChannelId, search);

        ViewBag.Search = search;
        SetPageHeader("Loại xuất dữ liệu", "file-export",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Cấu hình" },
            new BreadcrumbItem { Text = "Loại xuất dữ liệu" });
        ViewData["SearchQuery"] = search;
        ViewData["SearchPlaceholder"] = "Tìm theo tên, mã...";
        ViewData["PrimaryButtonText"] = "Tạo mới";
        ViewData["PrimaryButtonUrl"] = Url.Action("Create", "ExportType");
        
        return View(exportTypes);
    }

    [HttpGet]
    public IActionResult Create()
    {
        SetPageHeader("Tạo loại xuất", "plus-circle",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
            new BreadcrumbItem { Text = "Tạo mới" });
        
        return View(new CreateExportTypeRequest { ChannelId = ChannelId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateExportTypeRequest model, IFormFile? excelFile)
    {
        if (!ModelState.IsValid)
        {
            SetPageHeader("Tạo loại xuất", "plus-circle",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                new BreadcrumbItem { Text = "Tạo mới" });
            return View(model);
        }

        // Kiểm tra Code đã tồn tại
        if (await _exportTypeRepo.IsCodeExistsAsync(ChannelId, model.Code))
        {
            SetError("Mã loại xuất đã tồn tại");
            SetPageHeader("Tạo loại xuất", "plus-circle",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                new BreadcrumbItem { Text = "Tạo mới" });
            return View(model);
        }

        var exportType = new Core.Domain.Entities.Stg.ExportType
        {
            ChannelId = ChannelId,
            Name = model.Name,
            Code = model.Code,
            Description = model.Description,
            IsActive = true,
            Created = DateTime.UtcNow,
            CreatedBy = CurrentUser.Id,
            SearchMeta = $"{model.Name} {model.Code} {model.Description}".ToLower()
        };

        // Upload Excel file nếu có
        if (excelFile != null && excelFile.Length > 0)
        {
            var ext = Path.GetExtension(excelFile.FileName).ToLower();
            if (ext != ".xlsx" && ext != ".xls")
            {
                SetError("Chỉ chấp nhận file Excel (.xlsx, .xls)");
                SetPageHeader("Tạo loại xuất", "plus-circle",
                    new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                    new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                    new BreadcrumbItem { Text = "Tạo mới" });
                return View(model);
            }

            try
            {
                // Save file
                var subPath = $"export-configs/{ChannelId}";
                var fileName = $"{model.Code}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
                
                using var stream = excelFile.OpenReadStream();
                var filePath = await _storage.SaveFileAsync(stream, fileName, subPath);
                
                exportType.ExcelFilePath = filePath;
                exportType.ExcelFileName = excelFile.FileName;

                // Convert Excel to JSON
                // Save to temp location first
                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{ext}");
                using (var fileStream = System.IO.File.Create(tempPath))
                {
                    await excelFile.CopyToAsync(fileStream);
                }
                
                exportType.JsonConfig = await _excelConverter.ConvertAsync(tempPath, model.Code);
                
                // Clean up temp file
                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Excel file");
                SetError($"Lỗi xử lý file Excel: {ex.Message}");
                SetPageHeader("Tạo loại xuất", "plus-circle",
                    new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                    new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                    new BreadcrumbItem { Text = "Tạo mới" });
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
        SetPageHeader("Tạo loại xuất", "plus-circle",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
            new BreadcrumbItem { Text = "Tạo mới" });
        return View(model);
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var exportType = await _exportTypeRepo.GetByIdAsync(id);
        if (exportType == null || exportType.ChannelId != ChannelId)
        {
            SetError("Không tìm thấy loại xuất dữ liệu");
            return RedirectToAction(nameof(Index));
        }

        SetPageHeader("Sửa loại xuất", "edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
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

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(UpdateExportTypeRequest model, IFormFile? excelFile)
    {
        if (!ModelState.IsValid)
        {
            SetPageHeader("Sửa loại xuất", "edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                new BreadcrumbItem { Text = "Sửa" });
            return View(model);
        }

        var exportType = await _exportTypeRepo.GetByIdAsync(model.Id);
        if (exportType == null || exportType.ChannelId != ChannelId)
        {
            SetError("Không tìm thấy loại xuất dữ liệu");
            return RedirectToAction(nameof(Index));
        }

        // Kiểm tra Code đã tồn tại (trừ chính nó)
        if (await _exportTypeRepo.IsCodeExistsAsync(ChannelId, model.Code, model.Id))
        {
            SetError("Mã loại xuất đã tồn tại");
            SetPageHeader("Sửa loại xuất", "edit",
                new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                new BreadcrumbItem { Text = "Sửa" });
            return View(model);
        }

        exportType.Name = model.Name;
        exportType.Code = model.Code;
        exportType.Description = model.Description;
        exportType.IsActive = model.IsActive;
        exportType.Updated = DateTime.UtcNow;
        exportType.UpdatedBy = CurrentUser.Id;
        exportType.SearchMeta = $"{model.Name} {model.Code} {model.Description}".ToLower();

        // Upload Excel file mới nếu có
        if (excelFile != null && excelFile.Length > 0)
        {
            var ext = Path.GetExtension(excelFile.FileName).ToLower();
            if (ext != ".xlsx" && ext != ".xls")
            {
                SetError("Chỉ chấp nhận file Excel (.xlsx, .xls)");
                SetPageHeader("Sửa loại xuất", "edit",
                    new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                    new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                    new BreadcrumbItem { Text = "Sửa" });
                return View(model);
            }

            try
            {
                var subPath = $"export-configs/{ChannelId}";
                var fileName = $"{model.Code}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
                
                using var stream = excelFile.OpenReadStream();
                var filePath = await _storage.SaveFileAsync(stream, fileName, subPath);
                
                exportType.ExcelFilePath = filePath;
                exportType.ExcelFileName = excelFile.FileName;

                // Convert Excel to JSON
                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{ext}");
                using (var fileStream = System.IO.File.Create(tempPath))
                {
                    await excelFile.CopyToAsync(fileStream);
                }
                
                exportType.JsonConfig = await _excelConverter.ConvertAsync(tempPath, model.Code);
                
                // Clean up temp file
                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Excel file");
                SetError($"Lỗi xử lý file Excel: {ex.Message}");
                SetPageHeader("Sửa loại xuất", "edit",
                    new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
                    new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
                    new BreadcrumbItem { Text = "Sửa" });
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
        SetPageHeader("Sửa loại xuất", "edit",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Loại xuất dữ liệu", Url = Url.Action("Index", "ExportType") },
            new BreadcrumbItem { Text = "Sửa" });
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var exportType = await _exportTypeRepo.GetByIdAsync(id);
        if (exportType == null || exportType.ChannelId != ChannelId)
        {
            return Json(new { success = false, message = "Không tìm thấy loại xuất dữ liệu" });
        }

        var result = await _exportTypeRepo.DeleteAsync(id);
        if (result > 0)
        {
            return Json(new { success = true, message = "Xóa loại xuất dữ liệu thành công" });
        }

        return Json(new { success = false, message = "Xóa loại xuất dữ liệu thất bại" });
    }
}

// DTOs
public class CreateExportTypeRequest
{
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateExportTypeRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public string? ExcelFileName { get; set; }
    public string? JsonConfig { get; set; }
}
