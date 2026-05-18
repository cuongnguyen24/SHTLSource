using System.Globalization;
using System.Text.RegularExpressions;
using iText.Kernel.Pdf;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

public interface IDocTypeOcrZoneExtractionService
{
    Task<bool> TryPrefillDocumentFromConfiguredZonesAsync(long documentId, CancellationToken cancellationToken = default);
    Task<ApiResult<OcrZoneExtractResultDto>> ExtractTemporaryZoneAsync(long documentId, OcrZoneExtractRequest request, CancellationToken cancellationToken = default);
}

public sealed class OcrZoneExtractRequest
{
    public int FieldSettingId { get; set; }
    public int PageNumber { get; set; }
    public decimal XRatio { get; set; }
    public decimal YRatio { get; set; }
    public decimal WidthRatio { get; set; }
    public decimal HeightRatio { get; set; }
}

public sealed class OcrZoneExtractResultDto
{
    public int FieldSettingId { get; set; }
    public int FieldId { get; set; }
    public string FieldKey { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

public sealed class DocTypeOcrZoneExtractionService : IDocTypeOcrZoneExtractionService
{
    private static readonly Regex VietnameseDateRegex = new(
        @"ngày\s*(?<day>\d{1,2})\s*tháng\s*(?<month>\d{1,2})\s*năm\s*(?<year>\d{4})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly IAxeDocTypeRepository _docTypeRepo;
    private readonly IDocumentRepository _docRepo;
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOptions;
    private readonly ILogger<DocTypeOcrZoneExtractionService> _logger;

    public DocTypeOcrZoneExtractionService(
        IAxeDocTypeRepository docTypeRepo,
        IDocumentRepository docRepo,
        IStorageService storage,
        IOptions<StorageOptions> storageOptions,
        ILogger<DocTypeOcrZoneExtractionService> logger)
    {
        _docTypeRepo = docTypeRepo;
        _docRepo = docRepo;
        _storage = storage;
        _storageOptions = storageOptions.Value;
        _logger = logger;
    }

    public async Task<bool> TryPrefillDocumentFromConfiguredZonesAsync(long documentId, CancellationToken cancellationToken = default)
    {
        var doc = await _docRepo.GetByIdAsync(documentId);
        if (doc is null)
            return false;

        var zones = await _docTypeRepo.GetOcrZonesAsync(doc.DocTypeId);
        if (zones.Count == 0)
        {
            _logger.LogInformation(
                "OCR zone prefill skipped: no zones. DocumentId={DocumentId}, DocTypeId={DocTypeId}",
                documentId,
                doc.DocTypeId);
            return false;
        }

        var pdfBytes = await StoragePdfFileReader.ReadAllBytesAsync(
            _storage,
            _storageOptions,
            EnumeratePdfCandidates(doc),
            cancellationToken);
        if (pdfBytes is null || pdfBytes.Length == 0)
        {
            _logger.LogWarning(
                "OCR zone prefill skipped: PDF bytes unavailable. DocumentId={DocumentId}, SearchablePath={SearchablePath}, FilePath={FilePath}",
                documentId,
                doc.PathPdfSearchable,
                doc.FilePath);
            return false;
        }

        var settings = await _docTypeRepo.GetFieldSettingsByTypeAsync(doc.DocTypeId);
        var fields = await _docTypeRepo.GetAllFieldsAsync();
        var settingById = settings.ToDictionary(s => s.Id);
        var fieldById = fields.ToDictionary(f => f.Id);
        var currentValues = StgFieldToDocumentMapper.ExtractValues(doc);
        var changed = false;

        try
        {
            using var reader = new PdfReader(new MemoryStream(pdfBytes));
            using var pdf = new PdfDocument(reader);

            foreach (var zone in zones)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!TryResolveField(zone, settingById, fieldById, out var field, out var fieldKey))
                {
                    _logger.LogWarning(
                        "OCR zone skipped: field mapping missing. DocumentId={DocumentId}, FieldSettingId={FieldSettingId}, FieldId={FieldId}",
                        documentId,
                        zone.FieldSettingId,
                        zone.FieldId);
                    continue;
                }

                if (HasExistingValue(currentValues, fieldKey))
                    continue;

                var pageNumber = Math.Max(1, zone.PageNumber);
                if (pageNumber > pdf.GetNumberOfPages())
                    continue;

                var page = pdf.GetPage(pageNumber);
                var text = PdfOcrRegionTextExtractor.Extract(
                    page,
                    zone.XRatio,
                    zone.YRatio,
                    zone.WidthRatio,
                    zone.HeightRatio);
                if (string.IsNullOrWhiteSpace(text))
                {
                    _logger.LogWarning(
                        "OCR zone empty text. DocumentId={DocumentId}, FieldSettingId={FieldSettingId}, FieldKey={FieldKey}, Page={PageNumber}",
                        documentId,
                        zone.FieldSettingId,
                        fieldKey,
                        pageNumber);
                    continue;
                }

                var normalized = NormalizeValueForField(fieldKey, field, text);
                if (!TryApplyValue(doc, currentValues, fieldKey, field.Name, normalized, out var appliedKey))
                {
                    _logger.LogWarning(
                        "OCR zone text not applied. DocumentId={DocumentId}, FieldSettingId={FieldSettingId}, FieldKey={FieldKey}, Text={Text}",
                        documentId,
                        zone.FieldSettingId,
                        fieldKey,
                        TruncateForLog(normalized));
                    continue;
                }

                changed = true;
                _logger.LogInformation(
                    "OCR zone prefilled. DocumentId={DocumentId}, FieldKey={FieldKey}, Page={PageNumber}, Length={Length}",
                    documentId,
                    appliedKey,
                    pageNumber,
                    normalized.Length);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OCR zone prefill failed. DocumentId={DocumentId}", documentId);
            return false;
        }

        if (!changed)
            return false;

        doc.Updated = DateTime.UtcNow;
        await _docRepo.UpdateAsync(doc);
        return true;
    }

    public async Task<ApiResult<OcrZoneExtractResultDto>> ExtractTemporaryZoneAsync(
        long documentId,
        OcrZoneExtractRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.FieldSettingId <= 0)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Thieu truong cau hinh OCR.");
        if (request.PageNumber <= 0)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Trang OCR khong hop le.");
        if (request.WidthRatio <= 0 || request.HeightRatio <= 0)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Vung OCR phai co kich thuoc.");

        var doc = await _docRepo.GetByIdAsync(documentId);
        if (doc is null)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Tai lieu khong ton tai.");

        var settings = await _docTypeRepo.GetFieldSettingsByTypeAsync(doc.DocTypeId);
        var setting = settings.FirstOrDefault(x => x.Id == request.FieldSettingId);
        if (setting is null)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Truong cau hinh OCR khong thuoc loai tai lieu hien tai.");

        var fields = await _docTypeRepo.GetAllFieldsAsync();
        var field = fields.FirstOrDefault(x => x.Id == setting.IdField);
        var fieldId = field?.Id ?? setting.IdField;
        var fieldName = field?.Name ?? string.Empty;

        var fieldKey = StgFieldToDocumentMapper.ResolvePostFieldKey(fieldName, fieldId);
        if (string.IsNullOrWhiteSpace(fieldKey))
            return ApiResult<OcrZoneExtractResultDto>.Fail("Khong xac dinh duoc cot du lieu can map.");

        var pdfBytes = await StoragePdfFileReader.ReadAllBytesAsync(
            _storage,
            _storageOptions,
            EnumeratePdfCandidates(doc),
            cancellationToken);
        if (pdfBytes is null || pdfBytes.Length == 0)
            return ApiResult<OcrZoneExtractResultDto>.Fail("Khong doc duoc PDF 2 lop cua tai lieu.");

        try
        {
            using var reader = new PdfReader(new MemoryStream(pdfBytes));
            using var pdf = new PdfDocument(reader);
            if (request.PageNumber > pdf.GetNumberOfPages())
                return ApiResult<OcrZoneExtractResultDto>.Fail("Trang OCR vuot qua so trang PDF.");

            var text = PdfOcrRegionTextExtractor.ExtractStrict(
                pdf.GetPage(request.PageNumber),
                ClampRatio(request.XRatio),
                ClampRatio(request.YRatio),
                ClampRatio(request.WidthRatio),
                ClampRatio(request.HeightRatio));

            if (string.IsNullOrWhiteSpace(text))
                return ApiResult<OcrZoneExtractResultDto>.Fail("Khong boc duoc chu tu vung OCR nay. Hay keo rong vung hon hoac kiem tra PDF 2 lop.");

            var normalized = NormalizeValueForField(fieldKey, field, text);
            return ApiResult<OcrZoneExtractResultDto>.Ok(new OcrZoneExtractResultDto
            {
                FieldSettingId = request.FieldSettingId,
                FieldId = fieldId,
                FieldKey = fieldKey,
                Value = normalized
            }, "Da OCR lai vung va dua du lieu vao o nhap.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Temporary OCR zone extract failed. DocumentId={DocumentId}, FieldSettingId={FieldSettingId}", documentId, request.FieldSettingId);
            return ApiResult<OcrZoneExtractResultDto>.Fail("Loi khi OCR lai vung hien tai.");
        }
    }

    private static bool TryResolveField(
        DocTypeOcrZoneDto zone,
        IReadOnlyDictionary<int, StgDocFieldSettingDto> settingById,
        IReadOnlyDictionary<int, StgDocFieldDto> fieldById,
        out StgDocFieldDto field,
        out string fieldKey)
    {
        field = null!;
        fieldKey = string.Empty;

        if (settingById.TryGetValue(zone.FieldSettingId, out var setting)
            && fieldById.TryGetValue(setting.IdField, out field))
        {
            fieldKey = StgFieldToDocumentMapper.ResolvePostFieldKey(field.Name, field.Id);
            return !string.IsNullOrWhiteSpace(fieldKey);
        }

        if (zone.FieldId > 0 && fieldById.TryGetValue(zone.FieldId, out field))
        {
            fieldKey = StgFieldToDocumentMapper.ResolvePostFieldKey(field.Name, field.Id);
            return !string.IsNullOrWhiteSpace(fieldKey);
        }

        return false;
    }

    private static bool TryApplyValue(
        Document doc,
        IDictionary<string, string?> currentValues,
        string fieldKey,
        string fieldName,
        string value,
        out string appliedKey)
    {
        appliedKey = fieldKey;
        StgFieldToDocumentMapper.ApplyValue(doc, fieldKey, value);
        var resolved = ResolveStoredValue(doc, fieldKey, fieldName);
        if (!string.IsNullOrWhiteSpace(resolved))
        {
            currentValues[fieldKey] = resolved;
            return true;
        }

        if (!string.IsNullOrWhiteSpace(fieldName)
            && !string.Equals(fieldName, fieldKey, StringComparison.OrdinalIgnoreCase))
        {
            StgFieldToDocumentMapper.ApplyValue(doc, fieldName, value);
            resolved = ResolveStoredValue(doc, fieldKey, fieldName);
            if (!string.IsNullOrWhiteSpace(resolved))
            {
                appliedKey = fieldName;
                currentValues[fieldKey] = resolved;
                return true;
            }
        }

        return false;
    }

    private static string? ResolveStoredValue(Document doc, string fieldKey, string fieldName)
    {
        var values = StgFieldToDocumentMapper.ExtractValues(doc);
        if (values.TryGetValue(fieldKey, out var byKey) && !string.IsNullOrWhiteSpace(byKey))
            return byKey;
        if (values.TryGetValue(fieldName, out var byName) && !string.IsNullOrWhiteSpace(byName))
            return byName;
        return null;
    }

    private static decimal ClampRatio(decimal value) => Math.Min(1m, Math.Max(0m, value));

    private static string NormalizeValueForField(string fieldKey, StgDocFieldDto? field, string text)
    {
        var isDateField = string.Equals(field?.Datatype, "date", StringComparison.OrdinalIgnoreCase)
            || string.Equals(field?.Datatype, "datetime", StringComparison.OrdinalIgnoreCase)
            || fieldKey.Contains("date", StringComparison.OrdinalIgnoreCase)
            || fieldKey.Contains("issued", StringComparison.OrdinalIgnoreCase);

        if (!isDateField)
            return text;

        var match = VietnameseDateRegex.Match(text);
        if (!match.Success)
            return text;

        var day = int.Parse(match.Groups["day"].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(match.Groups["month"].Value, CultureInfo.InvariantCulture);
        var year = int.Parse(match.Groups["year"].Value, CultureInfo.InvariantCulture);
        return new DateTime(year, month, day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static IEnumerable<string> EnumeratePdfCandidates(Document doc)
    {
        if (!string.IsNullOrWhiteSpace(doc.PathPdfSearchable))
            yield return doc.PathPdfSearchable.Trim();

        if (!string.IsNullOrWhiteSpace(doc.FilePath))
            yield return doc.FilePath.Trim();

        if (!string.IsNullOrWhiteSpace(doc.PathConverted))
            yield return doc.PathConverted.Trim();

        if (!string.IsNullOrWhiteSpace(doc.PathOriginal))
            yield return doc.PathOriginal.Trim();
    }

    private static bool HasExistingValue(IReadOnlyDictionary<string, string?> values, string fieldKey)
    {
        if (!values.TryGetValue(fieldKey, out var value))
            return false;

        if (string.IsNullOrWhiteSpace(value))
            return false;

        return !string.Equals(fieldKey, "dc_title", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(fieldKey, "title", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(fieldKey, "name", StringComparison.OrdinalIgnoreCase);
    }

    private static string TruncateForLog(string value)
        => value.Length <= 120 ? value : value[..120] + "...";
}
