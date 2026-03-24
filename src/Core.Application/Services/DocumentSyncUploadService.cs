using Core.Application.Services.Axe;
using Core.Domain.Contracts;
using Core.Domain.Entities.Stg;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Stg;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

public interface IDocumentSyncUploadService
{
    /// <summary>
    /// Upload qua web: lưu file vào storage (cấu hình <c>Storage:RootPath</c>),
    /// parse đường dẫn tương đối theo <see cref="DocTypeSyncFullDto.Format"/> giống AXE <c>GetDataByFormat</c>,
    /// áp metadata theo <c>doc_type_sync_settings</c> (Title khớp placeholder trong Format, ví dụ <c>{nam}</c> → Title <c>nam</c>).
    /// </summary>
    Task<WebSyncUploadBatchResult> UploadAsync(
        int channelId,
        int userId,
        int syncTypeId,
        IReadOnlyList<SyncUploadFormFile> files,
        bool onlyPdf,
        CancellationToken cancellationToken = default);
}

public sealed class SyncUploadFormFile
{
    public required string RelativePath { get; init; }
    public required IFormFile File { get; init; }
}

public sealed class DocumentSyncUploadService : IDocumentSyncUploadService
{
    private readonly IAxeSyncTypeRepository _syncRepo;
    private readonly IAxeDocTypeRepository _fieldRepo;
    private readonly IDocumentRepository _documents;
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOpt;

    public DocumentSyncUploadService(
        IAxeSyncTypeRepository syncRepo,
        IAxeDocTypeRepository fieldRepo,
        IDocumentRepository documents,
        IStorageService storage,
        IOptions<StorageOptions> storageOpt)
    {
        _syncRepo = syncRepo;
        _fieldRepo = fieldRepo;
        _documents = documents;
        _storage = storage;
        _storageOpt = storageOpt.Value;
    }

    public async Task<WebSyncUploadBatchResult> UploadAsync(
        int channelId,
        int userId,
        int syncTypeId,
        IReadOnlyList<SyncUploadFormFile> files,
        bool onlyPdf,
        CancellationToken cancellationToken = default)
    {
        var results = new List<WebSyncUploadItemResult>();
        if (files.Count == 0)
        {
            results.Add(new WebSyncUploadItemResult
            {
                FileName = "",
                RelativePath = "",
                Success = false,
                Message = "Chưa chọn file"
            });
            return new WebSyncUploadBatchResult { Items = results };
        }

        var syncType = await _syncRepo.GetAsync(channelId, syncTypeId);
        if (syncType == null)
        {
            foreach (var f in files)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = f.File.FileName,
                    RelativePath = f.RelativePath,
                    Success = false,
                    Message = "Loại đồng bộ không tồn tại"
                });
            }
            return new WebSyncUploadBatchResult { Items = results };
        }

        if (syncType.DocTypeId <= 0)
        {
            foreach (var f in files)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = f.File.FileName,
                    RelativePath = f.RelativePath,
                    Success = false,
                    Message = "Loại đồng bộ chưa gắn loại tài liệu"
                });
            }
            return new WebSyncUploadBatchResult { Items = results };
        }

        var settings = (await _syncRepo.GetSettingsAsync(syncTypeId)).ToList();
        var allFields = (await _fieldRepo.GetAllFieldsAsync()).ToDictionary(x => x.Id);

        foreach (var item in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var rel = string.IsNullOrWhiteSpace(item.RelativePath) ? item.File.FileName : item.RelativePath.Trim();
            var fileName = Path.GetFileName(rel);
            if (string.IsNullOrEmpty(fileName))
                fileName = item.File.FileName;

            if (item.File.Length == 0)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fileName,
                    RelativePath = rel,
                    Success = false,
                    Message = "File rỗng"
                });
                continue;
            }

            if (item.File.Length > _storageOpt.MaxFileSizeBytes)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fileName,
                    RelativePath = rel,
                    Success = false,
                    Message = $"Vượt giới hạn dung lượng ({_storageOpt.MaxFileSizeBytes} byte)"
                });
                continue;
            }

            var ext = Path.GetExtension(fileName);
            if (onlyPdf && !string.Equals(ext, ".pdf", StringComparison.OrdinalIgnoreCase))
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fileName,
                    RelativePath = rel,
                    Success = false,
                    Message = "Đang bật \"Chỉ tải lên PDF\" — bỏ tích tùy chọn này hoặc chỉ chọn file .pdf"
                });
                continue;
            }

            if (_storageOpt.AllowedExtensions is { Length: > 0 }
                && !string.IsNullOrEmpty(ext)
                && !_storageOpt.AllowedExtensions.Any(x => x.Equals(ext, StringComparison.OrdinalIgnoreCase)))
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fileName,
                    RelativePath = rel,
                    Success = false,
                    Message = $"Đuôi file không được phép: {ext}"
                });
                continue;
            }

            var fn = fileName;
            try
            {
                var pathValues = SyncPathFormatParser.Parse(syncType.Format, rel);
                var doc = new Document
                {
                    ChannelId = channelId,
                    DocTypeId = syncType.DocTypeId,
                    SyncTypeId = syncTypeId,
                    FolderId = 0,
                    FileName = fileName,
                    PathOriginal = rel.Replace('\\', '/'),
                    Extension = ext,
                    FileSize = item.File.Length,
                    Status = DocumentStatus.Active,
                    CurrentStep = WorkflowStep.Extract,
                    OcrStatus = OcrStatus.NotRequested,
                    Version = 1,
                    Created = DateTime.UtcNow,
                    CreatedBy = userId
                };

                SyncPathFormatParser.ApplyFolderSegmentsToFields(doc, rel, maxDepth: 8);

                foreach (var st in settings)
                {
                    if (st.IsCatalog)
                        continue;
                    if (!allFields.TryGetValue(st.IdField, out var sf))
                        continue;
                    var raw = GetPathValue(pathValues, st.Title);
                    StgFieldToDocumentMapper.Apply(doc, sf.Name, raw);
                }

                if (string.IsNullOrWhiteSpace(doc.Name))
                    doc.Name = Path.GetFileNameWithoutExtension(fileName);

                var sub = Path.Combine(channelId.ToString(), "web-sync", syncTypeId.ToString(), DateTime.UtcNow.ToString("yyyyMMdd"));
                await using var stream = item.File.OpenReadStream();
                var stored = await _storage.SaveFileAsync(stream, fileName, sub);
                doc.FilePath = stored;

                doc.SearchMeta = string.Join(" ", new[]
                {
                    doc.Name, doc.SymbolNo, doc.RecordNo, doc.IssuedBy, doc.Author,
                    doc.Field1, doc.Field2, doc.Field3, doc.Field4, doc.Field5,
                    doc.Field6, doc.Field7, doc.Field8, doc.Field9, doc.Field10
                }.Where(x => !string.IsNullOrWhiteSpace(x)));

                var id = await _documents.InsertAsync(doc);
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fn,
                    RelativePath = rel,
                    Success = true,
                    Message = "Đã lưu",
                    DocumentId = id
                });
            }
            catch (Exception ex)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fn,
                    RelativePath = rel,
                    Success = false,
                    Message = ex.Message
                });
            }
        }

        return new WebSyncUploadBatchResult { Items = results };
    }

    private static string? GetPathValue(Dictionary<string, string?> pathValues, string? settingTitle)
    {
        if (string.IsNullOrWhiteSpace(settingTitle))
            return null;
        if (pathValues.TryGetValue(settingTitle, out var v) && !string.IsNullOrWhiteSpace(v))
            return v;
        var key = pathValues.Keys.FirstOrDefault(k => k.Equals(settingTitle.Trim(), StringComparison.OrdinalIgnoreCase));
        return key != null ? pathValues[key] : null;
    }
}
