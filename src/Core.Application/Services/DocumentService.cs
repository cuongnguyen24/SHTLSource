using Core.Domain.Contracts;
using Core.Domain.Entities.Stg;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Stg;
using Infrastructure.Storage;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

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
    private readonly IStorageService _storage;

    public DocumentService(IDocumentRepository docRepo, IStorageService storage)
    {
        _docRepo = docRepo;
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
        var items = await _docRepo.GetListAsync(user.ChannelId, filter, req.PageIndex, req.PageSize);
        var count = await _docRepo.CountAsync(user.ChannelId, filter);

        return new PaginatedResult<DocumentDto>
        {
            Items = items.Select(MapToDto),
            TotalCount = count,
            PageIndex = req.PageIndex,
            PageSize = req.PageSize
        };
    }

    public async Task<DocumentDto?> GetByIdAsync(long id, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(id);
        if (doc is null) return null;
        return MapToDto(doc);
    }

    public async Task<ApiResult<long>> CreateFromUploadAsync(UploadCallbackRequest req, ICurrentUser user)
    {
        var doc = new Document
        {
            ChannelId = req.ChannelId != 0 ? req.ChannelId : user.ChannelId,
            DocTypeId = req.DocTypeId,
            FolderId = req.FolderId,
            SyncTypeId = req.SyncType,
            Name = Path.GetFileNameWithoutExtension(req.FileName),
            FileName = req.FileName,
            FilePath = req.StoredPath,
            Extension = req.Extension ?? Path.GetExtension(req.FileName),
            FileSize = req.FileSize,
            WorkstationName = req.WorkstationName,
            Status = DocumentStatus.Active,
            CurrentStep = WorkflowStep.Extract,
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

    private static DocumentDto MapToDto(Document doc) => new()
    {
        Id = doc.Id,
        ChannelId = doc.ChannelId,
        Name = doc.Name,
        SymbolNo = doc.SymbolNo,
        RecordNo = doc.RecordNo,
        IssuedBy = doc.IssuedBy,
        Issued = doc.Issued,
        IssuedYear = doc.IssuedYear,
        Author = doc.Author,
        Noted = doc.Noted,
        DocTypeId = doc.DocTypeId,
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
        IsCheckedScan1 = doc.IsCheckedScan1,
        IsCheckedScan2 = doc.IsCheckedScan2,
        IsZoned = doc.IsZoned,
        IsExtracted = doc.IsExtracted,
        IsChecked1 = doc.IsChecked1,
        IsChecked2 = doc.IsChecked2,
        IsCheckedFinal = doc.IsCheckedFinal,
        IsCheckedLogic = doc.IsCheckedLogic,
        ExportStatus = doc.ExportStatus
    };
}

