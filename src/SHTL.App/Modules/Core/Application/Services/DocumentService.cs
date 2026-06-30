using iText.Kernel.Pdf;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;
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
    Task<ApiResult> ReplaceFileAsync(long id, IFormFile file, ICurrentUser user);
    Task<ApiResult> UpdateMetadataAsync(DocumentUpdateRequest req, ICurrentUser user);
    /// <summary>Id kế trong hàng đợi kiểm tra scan 1 (cùng thứ tự danh sách: id DESC).</summary>
    Task<long?> GetNextScanCheck1QueueIdAfterAsync(long completedId, string? search);
    /// <summary>Id kế trong hàng đợi kiểm tra scan 2.</summary>
    Task<long?> GetNextScanCheck2QueueIdAfterAsync(long completedId, string? search);
}

public class DocumentService : IDocumentService
{
    private readonly IDocumentRepository _docRepo;
    private readonly IAxeDocTypeRepository _docTypeRepo;
    private readonly ICnfRepository _cnfRepo;
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOptions;

    public DocumentService(
        IDocumentRepository docRepo,
        IAxeDocTypeRepository docTypeRepo,
        ICnfRepository cnfRepo,
        IStorageService storage,
        IOptions<StorageOptions> storageOptions)
    {
        _docRepo = docRepo;
        _docTypeRepo = docTypeRepo;
        _cnfRepo = cnfRepo;
        _storage = storage;
        _storageOptions = storageOptions.Value;
    }

    public async Task<PaginatedResult<DocumentDto>> GetListAsync(DocumentFilterRequest req, ICurrentUser user)
    {
        var filter = new DocumentFilterParams
        {
            Search = req.Search,
            Step = req.Step,
            ForScanCheck1Queue = req.ForScanCheck1Queue,
            ForScanCheck1Board = req.ForScanCheck1Board,
            CheckQueueListScope = req.CheckQueueListScope,
            IncludeExtractedInCheck1 = req.IncludeExtractedInCheck1,
            DocTypeId = req.DocTypeId,
            ExtractInputStatus = req.ExtractInputStatus,
            RequireCheckFirstScan = req.RequireCheckFirstScan,
            RequireCheckSecondScan = req.RequireCheckSecondScan,
            CreatedBy = req.CreatedBy,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            FolderId = req.FolderId,
            EnforceOnlyAssigned = req.EnforceOnlyAssigned,
            CurrentUserId = user.Id,
            IsAdminUser = user.IsAdmin
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

    public Task<long?> GetNextScanCheck1QueueIdAfterAsync(long completedId, string? search)
    {
        var filter = new DocumentFilterParams
        {
            ForScanCheck1Queue = true,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim()
        };
        return _docRepo.GetNextQueueIdAfterAsync(filter, completedId);
    }

    public Task<long?> GetNextScanCheck2QueueIdAfterAsync(long completedId, string? search)
    {
        var filter = new DocumentFilterParams
        {
            Step = WorkflowStep.CheckScan2,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim()
        };
        return _docRepo.GetNextQueueIdAfterAsync(filter, completedId);
    }

    public async Task<DocumentDto?> GetByIdAsync(long id, ICurrentUser user)
    {
        if (!await _docRepo.HasUserAccessAsync(id, user.Id, user.IsAdmin))
            return null;
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
        var initialStep = await WorkflowUploadInitialStep.ResolveAsync(_cnfRepo);
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
            CurrentStep = initialStep,
            IsOcrEnabled = queuedSearchable,
            OcrStatus = queuedSearchable ? OcrStatus.SearchablePdfQueued : OcrStatus.NotRequested,
            Created = DateTime.UtcNow,
            CreatedBy = user.Id,
            Version = 1
        };

        var id = await _docRepo.InsertAsync(doc);
        return ApiResult<long>.Ok(id, "Tài liệu đã được tạo");
    }

    public async Task<ApiResult> ReplaceFileAsync(long id, IFormFile file, ICurrentUser user)
    {
        if (file is null || file.Length <= 0)
            return ApiResult.Fail("Vui lòng chọn file thay thế.");
        if (_storageOptions.MaxFileSizeBytes > 0 && file.Length > _storageOptions.MaxFileSizeBytes)
            return ApiResult.Fail($"File vượt quá dung lượng tối đa {_storageOptions.MaxFileSizeBytes / 1024 / 1024}MB.");

        if (!await _docRepo.HasUserAccessAsync(id, user.Id, user.IsAdmin))
            return ApiResult.Fail("Bạn không có quyền truy cập tài liệu này.");

        var doc = await _docRepo.GetByIdAsync(id);
        if (doc is null || doc.Status == DocumentStatus.Deleted)
            return ApiResult.Fail("Tài liệu không tồn tại hoặc đã bị xóa.");
        if (string.IsNullOrWhiteSpace(doc.FilePath))
            return ApiResult.Fail("Tài liệu chưa có đường dẫn file để thay thế.");

        var oldRelPath = doc.FilePath.Replace('\\', '/');
        var oldFileName = Path.GetFileName(oldRelPath);
        if (string.IsNullOrWhiteSpace(oldFileName))
            return ApiResult.Fail("Đường dẫn file hiện tại không hợp lệ.");

        var oldExt = NormalizeExtension(Path.GetExtension(oldFileName));
        var newExt = NormalizeExtension(Path.GetExtension(file.FileName));
        if (string.IsNullOrWhiteSpace(newExt))
            return ApiResult.Fail("File thay thế phải có phần mở rộng.");
        if (_storageOptions.AllowedExtensions.Length > 0
            && !_storageOptions.AllowedExtensions.Select(NormalizeExtension).Contains(newExt, StringComparer.OrdinalIgnoreCase))
            return ApiResult.Fail("Định dạng file thay thế không được hỗ trợ.");
        if (!string.Equals(oldExt, newExt, StringComparison.OrdinalIgnoreCase))
            return ApiResult.Fail($"File thay thế phải cùng định dạng {oldExt}.");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        buffer.Position = 0;

        var markedOld = await _storage.MarkDeletedAsync(oldRelPath);
        if (!markedOld)
            return ApiResult.Fail("Không đổi tên được file cũ trên storage.");

        if (!string.IsNullOrWhiteSpace(doc.PathPdfSearchable)
            && !string.Equals(doc.PathPdfSearchable, oldRelPath, StringComparison.OrdinalIgnoreCase))
            await _storage.MarkDeletedAsync(doc.PathPdfSearchable);
        if (!string.IsNullOrWhiteSpace(doc.ThumbPath)
            && !string.Equals(doc.ThumbPath, oldRelPath, StringComparison.OrdinalIgnoreCase))
            await _storage.MarkDeletedAsync(doc.ThumbPath);

        var subPath = Path.GetDirectoryName(oldRelPath)?.Replace('\\', '/') ?? string.Empty;
        buffer.Position = 0;
        var storedPath = await _storage.SaveFileAsync(buffer, oldFileName, subPath);
        var looksLikePdf = SearchablePdfDisplay.LooksLikePdf(newExt, oldFileName, storedPath);

        doc.FileName = oldFileName;
        doc.FilePath = storedPath;
        doc.Extension = newExt;
        doc.FileSize = file.Length;
        doc.PageCount = looksLikePdf ? TryCountPdfPages(buffer) ?? doc.PageCount : 1;
        doc.PathPdfSearchable = null;
        doc.ThumbPath = null;
        doc.IsOcrEnabled = looksLikePdf;
        doc.OcrStatus = looksLikePdf ? OcrStatus.SearchablePdfQueued : OcrStatus.NotRequested;
        doc.CurrentStep = WorkflowStep.Scan;
        doc.LockedByStep = WorkflowStep.None;
        doc.LockedAt = null;
        doc.LockedByUserId = 0;
        doc.IsCheckedScan1 = false;
        doc.CheckedScan1At = null;
        doc.CheckedScan1By = 0;
        doc.CheckedScan1Result = StepResult.Pending;
        doc.IsCheckedScan2 = false;
        doc.CheckedScan2At = null;
        doc.CheckedScan2By = 0;
        doc.CheckedScan2Result = StepResult.Pending;
        doc.PageCountA4 = 0;
        doc.PageCountA3 = 0;
        doc.PageCountA2 = 0;
        doc.PageCountA1 = 0;
        doc.PageCountA0 = 0;
        doc.PageCountOther = 0;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        var affected = await _docRepo.UpdateFileReplacementAsync(doc);
        return affected > 0
            ? ApiResult.Ok("Đã thay thế file. File cũ đã được đổi tên hậu tố _deleteat.")
            : ApiResult.Fail("Không cập nhật được thông tin file thay thế.");
    }

    public async Task<ApiResult> UpdateMetadataAsync(DocumentUpdateRequest req, ICurrentUser user)
    {
        if (!await _docRepo.HasUserAccessAsync(req.Id, user.Id, user.IsAdmin))
            return ApiResult.Fail("Bạn không có quyền truy cập tài liệu này.");
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

    private static string NormalizeExtension(string? extension)
    {
        if (string.IsNullOrWhiteSpace(extension)) return string.Empty;
        var ext = extension.Trim();
        return ext.StartsWith('.') ? ext.ToLowerInvariant() : "." + ext.ToLowerInvariant();
    }

    private static int? TryCountPdfPages(Stream stream)
    {
        try
        {
            if (stream.CanSeek) stream.Position = 0;
            using var reader = new PdfReader(stream);
            using var pdf = new PdfDocument(reader);
            return pdf.GetNumberOfPages();
        }
        catch
        {
            return null;
        }
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
        MinDpi = doc.MinDpi,
        MaxDpi = doc.MaxDpi,
        Created = doc.Created,
        CreatedBy = doc.CreatedBy,
        ExtractedAt = doc.ExtractedAt,
        ExtractedBy = doc.ExtractedBy,
        Checked1At = doc.Checked1At,
        Checked1By = doc.Checked1By,
        Checked1Result = doc.Checked1Result,
        Checked1ReturnCount = doc.Checked1ReturnCount,
        Checked2At = doc.Checked2At,
        Checked2By = doc.Checked2By,
        IsCheckedScan1 = doc.IsCheckedScan1,
        CheckedScan1At = doc.CheckedScan1At,
        CheckedScan1Result = doc.CheckedScan1Result,
        IsCheckedScan2 = doc.IsCheckedScan2,
        CheckedScan2At = doc.CheckedScan2At,
        CheckedScan2Result = doc.CheckedScan2Result,
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

