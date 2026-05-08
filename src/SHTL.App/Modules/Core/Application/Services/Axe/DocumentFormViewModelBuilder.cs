using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Core.Domain.Enums;
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

    public DocumentFormViewModelBuilder(
        IAxeDocTypeRepository docTypeRepo,
        IDocumentRepository docRepo,
        IFormCellRepository cellRepo,
        IUserRepository userRepo,
        ICnfRepository cnfRepo)
    {
        _docTypeRepo = docTypeRepo;
        _docRepo = docRepo;
        _cellRepo = cellRepo;
        _userRepo = userRepo;
        _cnfRepo = cnfRepo;
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

    public async Task<DocumentFormViewModel> BuildForExtractAsync(long documentId)
    {
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

        return BuildViewModel(
            docType, doc, settings, allFields, groups, categories, patterns, cells, userNames,
            recordInfoKeys, sameRecordDocs);
    }

    public Task<DocumentFormViewModel> BuildForCheck1Async(long documentId)
        => BuildForExtractAsync(documentId);

    public Task<DocumentFormViewModel> BuildForCheck2Async(long documentId)
        => BuildForExtractAsync(documentId);

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
        IReadOnlyList<DocumentDto>? sameRecordDocs = null)
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
            SameRecordDocuments = sameRecordDocs ?? Array.Empty<DocumentDto>()
        };
    }

    private FieldSettingViewModel MapToFieldSettingViewModel(
        StgDocFieldSettingDto setting,
        Dictionary<int, StgDocFieldDto> fieldMap)
    {
        var field = fieldMap.GetValueOrDefault(setting.IdField);
        return new FieldSettingViewModel
        {
            Id = setting.Id,
            FieldId = setting.IdField,
            FieldName = field?.Name ?? "",
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
            Checked1By = doc.Checked1By,
            Checked1At = doc.Checked1At,
            Checked1ReturnReason = doc.Checked1ReturnReason,
            Checked2By = doc.Checked2By,
            Checked2At = doc.Checked2At,
            Checked2ReturnReason = doc.Checked2ReturnReason,
            CurrentStep = doc.CurrentStep,
            Status = doc.Status,
            PageCount = doc.PageCount,
            MinDpi = doc.MinDpi,
            MaxDpi = doc.MaxDpi,
            OcrStatus = doc.OcrStatus,
            PathPdfSearchable = doc.PathPdfSearchable
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

    /// <summary>Convert INT input type ID sang string.</summary>
    private static string GetInputTypeString(int inputTypeId)
    {
        return inputTypeId switch
        {
            1 => "text",
            2 => "textarea",
            3 => "number",
            4 => "date",
            5 => "select",
            6 => "radio",
            7 => "checkbox",
            _ => "text"
        };
    }
}
