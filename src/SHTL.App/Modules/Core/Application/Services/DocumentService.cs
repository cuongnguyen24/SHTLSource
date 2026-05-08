using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IDocumentService
{
    Task<PaginatedResult<DocumentDto>> GetListAsync(DocumentFilterRequest req, ICurrentUser user);
    Task<DocumentDto?> GetByIdAsync(long id, ICurrentUser user);
    Task<ApiResult<long>> CreateFromUploadAsync(UploadCallbackRequest req, ICurrentUser user);
    Task<ApiResult> UpdateMetadataAsync(DocumentUpdateRequest req, ICurrentUser user);
}

public class DocumentService : IDocumentService
{
    private readonly IDocumentRepository _docRepo;
    private readonly IAxeDocTypeRepository _docTypeRepo;
    private readonly IStorageService _storage;

    public DocumentService(IDocumentRepository docRepo, IAxeDocTypeRepository docTypeRepo, IStorageService storage)
    {
        _docRepo = docRepo;
        _docTypeRepo = docTypeRepo;
        _storage = storage;
    }

    public async Task<PaginatedResult<DocumentDto>> GetListAsync(DocumentFilterRequest req, ICurrentUser user)
    {
        var filter = new DocumentFilterParams
        {
            Search = req.Search,
            Step = req.Step,
            DocTypeId = req.DocTypeId,
            CreatedBy = req.CreatedBy,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            FolderId = req.FolderId
        };
        var items = await _docRepo.GetListAsync(filter, req.PageIndex, req.PageSize);
        var count = await _docRepo.CountAsync(filter);
        var docTypeMap = (await _docTypeRepo.ListDocTypesBriefAsync())
            .GroupBy(x => x.Id)
            .ToDictionary(g => g.Key, g => g.First().Name);

        return new PaginatedResult<DocumentDto>
        {
            Items = items.Select(x =>
            {
                docTypeMap.TryGetValue(x.DocTypeId, out var docTypeName);
                return MapToDto(x, docTypeName);
            }),
            TotalCount = count,
            PageIndex = req.PageIndex,
            PageSize = req.PageSize
        };
    }

    public async Task<DocumentDto?> GetByIdAsync(long id, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(id);
        if (doc is null) return null;
        var docTypeMap = (await _docTypeRepo.ListDocTypesBriefAsync())
            .GroupBy(x => x.Id)
            .ToDictionary(g => g.Key, g => g.First().Name);
        docTypeMap.TryGetValue(doc.DocTypeId, out var docTypeName);
        return MapToDto(doc, docTypeName);
    }

    public async Task<ApiResult<long>> CreateFromUploadAsync(UploadCallbackRequest req, ICurrentUser user)
    {
        var ext = req.Extension ?? Path.GetExtension(req.FileName);
        var queuedSearchable = SearchablePdfDisplay.LooksLikePdf(ext, req.FileName, req.StoredPath);
        var doc = new Document
        {
            DocTypeId = req.DocTypeId,
            FolderId = req.FolderId,
            SyncTypeId = req.SyncType,
            Name = Path.GetFileNameWithoutExtension(req.FileName),
            FileName = req.FileName,
            FilePath = req.StoredPath,
            Extension = ext,
            FileSize = req.FileSize,
            WorkstationName = req.WorkstationName,
            Status = DocumentStatus.Active,
            CurrentStep = WorkflowStep.Extract,
            IsOcrEnabled = queuedSearchable,
            OcrStatus = queuedSearchable ? OcrStatus.SearchablePdfQueued : OcrStatus.NotRequested,
            Created = DateTime.UtcNow,
            CreatedBy = user.Id,
            Version = 1
        };

        var id = await _docRepo.InsertAsync(doc);
        return ApiResult<long>.Ok(id, "Tài liệu đã được tạo");
    }

    public async Task<ApiResult> UpdateMetadataAsync(DocumentUpdateRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.Id);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");

        // Map fields
        doc.Name = req.Name;
        doc.SymbolNo = req.SymbolNo;
        doc.RecordNo = req.RecordNo;
        doc.IssuedBy = req.IssuedBy;
        doc.Issued = req.Issued;
        doc.IssuedYear = req.IssuedYear;
        doc.Author = req.Author;
        doc.Noted = req.Noted;
        doc.DocTypeId = req.DocTypeId;
        doc.RecordTypeId = req.RecordTypeId;
        doc.ContentTypeId = req.ContentTypeId;
        doc.SyncTypeId = req.SyncTypeId;
        doc.FolderId = req.FolderId;
        doc.DeptId = req.DeptId;
        doc.Field1 = req.Field1;
        doc.Field2 = req.Field2;
        doc.Field3 = req.Field3;
        doc.Field4 = req.Field4;
        doc.Field5 = req.Field5;
        doc.Field6 = req.Field6;
        doc.Field7 = req.Field7;
        doc.Field8 = req.Field8;
        doc.Field9 = req.Field9;
        doc.Field10 = req.Field10;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        // Build search meta
        doc.SearchMeta = string.Join(" ", new[] {
            doc.Name, doc.SymbolNo, doc.RecordNo, doc.IssuedBy, doc.Author,
            doc.Field1, doc.Field2, doc.Field3, doc.Field4, doc.Field5
        }.Where(x => !string.IsNullOrWhiteSpace(x)));

        await _docRepo.UpdateAsync(doc);
        return ApiResult.Ok("Đã cập nhật thông tin tài liệu");
    }

    private static DocumentDto MapToDto(Document doc, string? docTypeName = null) => new()
    {
        Id = doc.Id,
        Name = doc.Name,
        SymbolNo = doc.SymbolNo,
        RecordNo = doc.RecordNo,
        IssuedBy = doc.IssuedBy,
        Issued = doc.Issued,
        IssuedYear = doc.IssuedYear,
        Author = doc.Author,
        Noted = doc.Noted,
        Field1 = doc.Field1,
        Field2 = doc.Field2,
        Field3 = doc.Field3,
        Field4 = doc.Field4,
        Field5 = doc.Field5,
        Field6 = doc.Field6,
        Field7 = doc.Field7,
        Field8 = doc.Field8,
        Checked1ReturnReason = doc.Checked1ReturnReason,
        Checked2ReturnReason = doc.Checked2ReturnReason,
        DocTypeId = doc.DocTypeId,
        DocTypeName = docTypeName,
        FolderId = (int)doc.FolderId,
        CurrentStep = doc.CurrentStep,
        Status = doc.Status,
        FileName = doc.FileName,
        FilePath = doc.FilePath,
        ThumbPath = doc.ThumbPath,
        Extension = doc.Extension,
        FileSize = doc.FileSize,
        PageCount = doc.PageCount,
        Created = doc.Created,
        CreatedBy = doc.CreatedBy,
        ExtractedAt = doc.ExtractedAt,
        ExtractedBy = doc.ExtractedBy,
        Checked1At = doc.Checked1At,
        Checked1By = doc.Checked1By,
        Checked2At = doc.Checked2At,
        Checked2By = doc.Checked2By,
        IsCheckedScan1 = doc.IsCheckedScan1,
        IsCheckedScan2 = doc.IsCheckedScan2,
        IsZoned = doc.IsZoned,
        IsExtracted = doc.IsExtracted,
        IsChecked1 = doc.IsChecked1,
        IsChecked2 = doc.IsChecked2,
        IsCheckedFinal = doc.IsCheckedFinal,
        IsCheckedLogic = doc.IsCheckedLogic,
        ExportStatus = doc.ExportStatus,
        OcrStatus = doc.OcrStatus,
        PathPdfSearchable = doc.PathPdfSearchable
    };

}

