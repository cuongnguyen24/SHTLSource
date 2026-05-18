using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Shared.Contracts.Dtos;
using SHTL.Modules.Shared.Contracts.ViewModels;

namespace SHTL.Modules.Core.Application.Services.Axe;

public class DocumentFormViewModelBuilder : IDocumentFormViewModelBuilder
{
    private readonly IAxeDocTypeRepository _docTypeRepo;
    private readonly IDocumentRepository _docRepo;
    private readonly IFormCellRepository _cellRepo;
    private readonly IUserRepository _userRepo;
    private readonly ICnfRepository _cnfRepo;
    private readonly IDocTypeOcrZoneExtractionService _ocrZoneExtraction;

    public DocumentFormViewModelBuilder(
        IAxeDocTypeRepository docTypeRepo,
        IDocumentRepository docRepo,
        IFormCellRepository cellRepo,
        IUserRepository userRepo,
        ICnfRepository cnfRepo,
        IDocTypeOcrZoneExtractionService ocrZoneExtraction)
    {
        _docTypeRepo = docTypeRepo;
        _docRepo = docRepo;
        _cellRepo = cellRepo;
        _userRepo = userRepo;
        _cnfRepo = cnfRepo;
        _ocrZoneExtraction = ocrZoneExtraction;
    }

    public async Task<DocumentFormViewModel> BuildForCreateAsync(int docTypeId)
    {
        var docType = await _docTypeRepo.GetDocTypeAsync(docTypeId);
        if (docType == null) throw new InvalidOperationException($"DocType {docTypeId} not found");

        var settings = await _docTypeRepo.GetFieldSettingsByTypeAsync(docTypeId);
        var allFields = await _docTypeRepo.GetAllFieldsAsync();
        var groups = await _docTypeRepo.GetFieldGroupsAsync();
        var categories = await _docTypeRepo.GetCategoryTypesAsync();
        var patterns = await _docTypeRepo.GetPatternTypesAsync();

        return BuildViewModel(docType, null, settings, allFields, groups, categories, patterns,
            Enumerable.Empty<FormCell>(), new Dictionary<int, string>());
    }

    public async Task<DocumentFormViewModel> BuildForExtractAsync(long documentId, int currentUserId, bool isAdminUser)
    {
        if (!await _docRepo.HasUserAccessAsync(documentId, currentUserId, isAdminUser))
            throw new InvalidOperationException("Access denied");
        await _ocrZoneExtraction.TryPrefillDocumentFromConfiguredZonesAsync(documentId);

        var doc = await _docRepo.GetByIdAsync(documentId);
        if (doc == null) throw new InvalidOperationException($"Document {documentId} not found");

        var docType = await _docTypeRepo.GetDocTypeAsync(doc.DocTypeId);
        if (docType == null) throw new InvalidOperationException($"DocType {doc.DocTypeId} not found");

        var settings = await _docTypeRepo.GetFieldSettingsByTypeAsync(doc.DocTypeId);
        var allFields = await _docTypeRepo.GetAllFieldsAsync();
        var groups = await _docTypeRepo.GetFieldGroupsAsync();
        var categories = await _docTypeRepo.GetCategoryTypesAsync();
        var patterns = await _docTypeRepo.GetPatternTypesAsync();
        var cells = await _cellRepo.GetByDocumentAsync(documentId);
        var userNames = await BuildUserMapAsync(doc);
        var recordInfoKeys = await LoadSetRecordInfoKeysAsync();
        var sameRecordDocs = await BuildSameRecordDocumentsAsync(doc.Id, recordInfoKeys);
        var ocrZones = await _docTypeRepo.GetOcrZonesAsync(doc.DocTypeId);

        return BuildViewModel(
            docType, doc, settings, allFields, groups, categories, patterns, cells, userNames,
            recordInfoKeys, sameRecordDocs, ocrZones);
    }

    public Task<DocumentFormViewModel> BuildForCheck1Async(long documentId, int currentUserId, bool isAdminUser)
        => BuildForExtractAsync(documentId, currentUserId, isAdminUser);

    public Task<DocumentFormViewModel> BuildForCheck2Async(long documentId, int currentUserId, bool isAdminUser)
        => BuildForExtractAsync(documentId, currentUserId, isAdminUser);

    private DocumentFormViewModel BuildViewModel(
        DocTypeFullDto docType,
        Document? doc,
        IReadOnlyList<StgDocFieldSettingDto> settings,
        IReadOnlyList<StgDocFieldDto> allFields,
        IReadOnlyList<StgDocFieldGroupDto> groups,
        IReadOnlyList<CategoryTypeDto> categories,
        IReadOnlyList<PatternTypeDto> patterns,
        IEnumerable<FormCell> cells,
        IDictionary<int, string> userNames,
        IReadOnlyList<string>? recordInfoKeys = null,
        IReadOnlyList<DocumentDto>? sameRecordDocs = null,
        IReadOnlyList<DocTypeOcrZoneDto>? ocrZones = null)
    {
        var fieldMap = allFields.ToDictionary(f => f.Id);
        var fieldSettings = settings
            .OrderBy(s => s.Weight)
            .Select(s => MapToFieldSettingViewModel(s, fieldMap))
            .ToList();

        var groupMap = groups.ToDictionary(g => g.Id, g => new FieldGroupViewModel
        {
            Id = g.Id,
            Name = g.Name,
            GroupName = g.GroupName,
            Weight = g.Weight,
            ParentId = g.IdParent
        });

        var fieldValues = new Dictionary<string, string?>();
        if (doc != null)
        {
            fieldValues = StgFieldToDocumentMapper.ExtractValues(doc);
            // Always display document title from physical file_name in Extract/Check forms.
            fieldValues["dc_title"] = string.IsNullOrWhiteSpace(doc.FileName) ? doc.Name : doc.FileName;
        }

        var docDto = doc != null ? MapToDocumentDto(doc) : null;

        return new DocumentFormViewModel
        {
            Document = docDto,
            DocType = docType,
            FieldSettings = fieldSettings,
            FieldGroups = groupMap,
            CategoryTypes = categories,
            PatternTypes = patterns,
            FieldValues = fieldValues,
            Cells = cells,
            UserNames = userNames,
            RecordInfoKeys = recordInfoKeys ?? Array.Empty<string>(),
            SameRecordDocuments = sameRecordDocs ?? Array.Empty<DocumentDto>(),
            OcrZones = (ocrZones ?? Array.Empty<DocTypeOcrZoneDto>())
                .Where(z => z.FieldSettingId > 0 && z.PageNumber > 0)
                .Select(z => new OcrZoneViewModel
                {
                    Id = z.Id,
                    FieldSettingId = z.FieldSettingId,
                    FieldId = z.FieldId,
                    PageNumber = z.PageNumber,
                    XRatio = z.XRatio,
                    YRatio = z.YRatio,
                    WidthRatio = z.WidthRatio,
                    HeightRatio = z.HeightRatio,
                    Label = z.Label
                })
                .ToList()
        };
    }

    private FieldSettingViewModel MapToFieldSettingViewModel(
        StgDocFieldSettingDto setting,
        Dictionary<int, StgDocFieldDto> fieldMap)
    {
        var field = fieldMap.GetValueOrDefault(setting.IdField);
        var rawName = field?.Name ?? "";
        return new FieldSettingViewModel
        {
            Id = setting.Id,
            FieldId = setting.IdField,
            FieldName = rawName,
            PostFieldKey = StgFieldToDocumentMapper.ResolvePostFieldKey(rawName, setting.IdField),
            Title = string.IsNullOrEmpty(setting.Title) ? (field?.Title ?? "") : setting.Title,
            InputType = GetInputTypeString(setting.IType),
            Datatype = field?.Datatype ?? "",
            Row = setting.IRow,
            Col = setting.ICol,
            Weight = setting.Weight,
            GroupId = setting.IdFieldGroup,
            IsRequired = setting.IsRequired,
            MinLen = setting.MinLen,
            MaxLen = setting.MaxLen,
            MinValue = setting.MinValue,
            MaxValue = setting.MaxValue,
            PatternCustom = setting.PatternCustom,
            PatternTypeId = setting.IdPatternType,
            IsReadOnly = setting.IsReadOnly || string.Equals(field?.Name, "dc_title", StringComparison.OrdinalIgnoreCase),
            IsUpperCase = setting.IsUpperCase,
            IsCapitalize = setting.IsCapitalize,
            IsMulti = setting.IsMulti,
            FixValue = setting.FixValue,
            Format = setting.Format,
            IsCatalog = setting.IsCatalog,
            IsCatalogMain = setting.IsCatalogMain,
            CategoryTypeId = setting.IdCategoryType,
            CssClass = field?.CClass
        };
    }

    private DocumentDto MapToDocumentDto(Document doc)
    {
        return new DocumentDto
        {
            Id = doc.Id,
            DocTypeId = doc.DocTypeId,
            Name = doc.Name,
            FileName = doc.FileName,
            FilePath = doc.FilePath,
            Extension = doc.Extension,
            SymbolNo = doc.SymbolNo,
            RecordNo = doc.RecordNo,
            IssuedBy = doc.IssuedBy,
            Author = doc.Author,
            Issued = doc.Issued,
            IssuedYear = doc.IssuedYear,
            Noted = doc.Noted,
            Field1 = doc.Field1,
            Field2 = doc.Field2,
            Field3 = doc.Field3,
            Field4 = doc.Field4,
            Field5 = doc.Field5,
            Field6 = doc.Field6,
            Field7 = doc.Field7,
            Field8 = doc.Field8,
            CreatedBy = doc.CreatedBy,
            Created = doc.Created,
            ExtractedBy = doc.ExtractedBy,
            ExtractedAt = doc.ExtractedAt,
            IsExtracted = doc.IsExtracted,
            Checked1By = doc.Checked1By,
            Checked1At = doc.Checked1At,
            Checked1Result = doc.Checked1Result,
            Checked1ReturnCount = doc.Checked1ReturnCount,
            Checked1ReturnReason = doc.Checked1ReturnReason,
            Checked2By = doc.Checked2By,
            Checked2At = doc.Checked2At,
            Checked2ReturnReason = doc.Checked2ReturnReason,
            IsCheckedScan1 = doc.IsCheckedScan1,
            IsCheckedScan2 = doc.IsCheckedScan2,
            CurrentStep = doc.CurrentStep,
            Status = doc.Status,
            PageCount = doc.PageCount,
            MinDpi = doc.MinDpi,
            MaxDpi = doc.MaxDpi,
            OcrStatus = doc.OcrStatus,
            PathPdfSearchable = doc.PathPdfSearchable,
            IsChecked1 = doc.IsChecked1,
            IsChecked2 = doc.IsChecked2
        };
    }

    private async Task<IReadOnlyList<string>> LoadSetRecordInfoKeysAsync()
    {
        var configs = await _cnfRepo.GetConfigsAsync();
        var value = configs
            .FirstOrDefault(x => x.Key.Equals("SetRecordInfo", StringComparison.OrdinalIgnoreCase))
            ?.Value;

        return (value ?? string.Empty)
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<IReadOnlyList<DocumentDto>> BuildSameRecordDocumentsAsync(long documentId, IReadOnlyList<string> recordInfoKeys)
    {
        if (recordInfoKeys.Count == 0)
            return Array.Empty<DocumentDto>();

        var docs = await _docRepo.GetSameRecordDocumentsAsync(documentId, recordInfoKeys, 500);
        return docs
            .OrderByDescending(x => x.Id == documentId)
            .ThenByDescending(x => x.Id)
            .Select(MapToDocumentDto)
            .ToList();
    }

    private async Task<Dictionary<int, string>> BuildUserMapAsync(Document doc)
    {
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
        return names;
    }

    /// <summary>Convert INT input type ID sang string. Radio/Checkbox (6/7) đã bỏ — fallback về "text" để tương thích dữ liệu cũ.</summary>
    private static string GetInputTypeString(int inputTypeId)
    {
        return inputTypeId switch
        {
            1 => "text",
            2 => "textarea",
            3 => "number",
            4 => "date",
            5 => "select",
            _ => "text"
        };
    }
}
