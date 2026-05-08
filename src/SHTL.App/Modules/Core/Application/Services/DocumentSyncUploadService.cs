using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IDocumentSyncUploadService
{
    /// <summary>
    /// Upload qua web: lưu file vào storage (cấu hình <c>Storage:RootPath</c>) theo cấu trúc thư mục sau khi bỏ <see cref="DocTypeSyncFullDto.ScanPathRoot"/>,
    /// parse path logic theo <see cref="DocTypeSyncFullDto.Format"/> (port AXE <c>GetDataByFormat</c>),
    /// áp metadata theo <c>doc_type_sync_settings</c> (Title khớp placeholder trong Format, ví dụ <c>{nam}</c> → Title <c>nam</c>).
    /// </summary>
    Task<WebSyncUploadBatchResult> UploadAsync(
        int userId,
        IReadOnlyList<int> syncTypeIds,
        IReadOnlyList<SyncUploadFormFile> files,
        bool onlyPdf,
        string? pathPrefix = null,
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
    private readonly IDocumentPageRepository _documentPages;
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOpt;

    public DocumentSyncUploadService(
        IAxeSyncTypeRepository syncRepo,
        IAxeDocTypeRepository fieldRepo,
        IDocumentRepository documents,
        IDocumentPageRepository documentPages,
        IStorageService storage,
        IOptions<StorageOptions> storageOpt)
    {
        _syncRepo = syncRepo;
        _fieldRepo = fieldRepo;
        _documents = documents;
        _documentPages = documentPages;
        _storage = storage;
        _storageOpt = storageOpt.Value;
    }

    public async Task<WebSyncUploadBatchResult> UploadAsync(
        int userId,
        IReadOnlyList<int> syncTypeIds,
        IReadOnlyList<SyncUploadFormFile> files,
        bool onlyPdf,
        string? pathPrefix = null,
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

        var selectedIds = (syncTypeIds ?? Array.Empty<int>())
            .Where(x => x > 0)
            .Distinct()
            .ToHashSet();
        if (selectedIds.Count == 0)
        {
            foreach (var f in files)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = f.File.FileName,
                    RelativePath = f.RelativePath,
                    Success = false,
                    Message = "Chưa chọn loại đồng bộ"
                });
            }
            return new WebSyncUploadBatchResult { Items = results };
        }

        var allSyncTypes = (await _syncRepo.ListAsync(null))
            .Where(x => x.DocTypeId > 0)
            .OrderBy(x => x.Weight)
            .ThenBy(x => x.Id)
            .ToList();
        var selectedSyncTypes = allSyncTypes
            .Where(x => selectedIds.Contains(x.Id))
            .ToList();
        if (selectedSyncTypes.Count == 0)
        {
            foreach (var f in files)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = f.File.FileName,
                    RelativePath = f.RelativePath,
                    Success = false,
                    Message = "Không tìm thấy loại đồng bộ đã chọn"
                });
            }
            return new WebSyncUploadBatchResult { Items = results };
        }

        // Tự mở rộng theo "họ cấu trúc" để đảm bảo các loại trong cùng bộ (Bìa/Tài liệu) được chia đúng.
        var familyRootTokens = selectedSyncTypes
            .Select(x => GetFirstLiteralSegment(x.Format))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var candidateSyncTypes = allSyncTypes
            .Where(x => selectedIds.Contains(x.Id)
                        || (GetFirstLiteralSegment(x.Format) is string token && familyRootTokens.Contains(token)))
            .DistinctBy(x => x.Id)
            .OrderBy(x => x.Weight)
            .ThenBy(x => x.Id)
            .ToList();
        if (candidateSyncTypes.Count == 0 || candidateSyncTypes.Any(x => x.DocTypeId <= 0))
        {
            foreach (var f in files)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = f.File.FileName,
                    RelativePath = f.RelativePath,
                    Success = false,
                    Message = "Loại đồng bộ không hợp lệ hoặc chưa gắn loại tài liệu"
                });
            }
            return new WebSyncUploadBatchResult { Items = results };
        }

        var settingsBySyncTypeId = new Dictionary<int, List<DocTypeSyncSettingDto>>();
        foreach (var st in candidateSyncTypes)
            settingsBySyncTypeId[st.Id] = (await _syncRepo.GetSettingsAsync(st.Id)).ToList();

        var allFields = (await _fieldRepo.GetAllFieldsAsync()).ToDictionary(x => x.Id);

        foreach (var item in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var relRaw = string.IsNullOrWhiteSpace(item.RelativePath) ? item.File.FileName : item.RelativePath.Trim();
            var rel = CombinePathPrefix(pathPrefix, relRaw);
            var normalizedRel = rel.Replace('\\', '/');
            var matchedSync = ResolveSyncTypeForPath(normalizedRel, candidateSyncTypes) ?? candidateSyncTypes[0];
            var settings = settingsBySyncTypeId.TryGetValue(matchedSync.Id, out var value) ? value : new List<DocTypeSyncSettingDto>();
            var logicalPath = BuildLogicalPathByFormat(normalizedRel, matchedSync);
            var fileName = Path.GetFileName(string.IsNullOrEmpty(logicalPath) ? rel : logicalPath.Replace('/', Path.DirectorySeparatorChar));
            if (string.IsNullOrEmpty(fileName))
                fileName = item.File.FileName;
            var relForMeta = string.IsNullOrEmpty(logicalPath) ? rel : logicalPath.Replace('\\', '/');

            if (item.File.Length == 0)
            {
                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fileName,
                    RelativePath = relRaw,
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
                    RelativePath = relRaw,
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
                    RelativePath = relRaw,
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
                    RelativePath = relRaw,
                    Success = false,
                    Message = $"Đuôi file không được phép: {ext}"
                });
                continue;
            }

            var fn = fileName;
            try
            {
                var pathValues = ParseBySyncFormat(matchedSync.Format, relForMeta);
                var doc = new Document
                {
                    DocTypeId = matchedSync.DocTypeId,
                    SyncTypeId = matchedSync.Id,
                    FolderId = 0,
                    FileName = fileName,
                    PathOriginal = relForMeta,
                    Extension = ext,
                    FileSize = item.File.Length,
                    Status = DocumentStatus.Active,
                    CurrentStep = WorkflowStep.Extract,
                    IsOcrEnabled = SearchablePdfDisplay.LooksLikePdf(ext, fileName, null),
                    OcrStatus = SearchablePdfDisplay.LooksLikePdf(ext, fileName, null)
                        ? OcrStatus.SearchablePdfQueued
                        : OcrStatus.NotRequested,
                    Version = 1,
                    Created = DateTime.UtcNow,
                    CreatedBy = userId,
                    Updated = DateTime.UtcNow,
                    UpdatedBy = userId
                };

                SyncPathFormatParser.ApplyFolderSegmentsToFields(doc, relForMeta, maxDepth: 15);

                foreach (var st in settings)
                {
                    if (st.IsCatalog)
                        continue;
                    if (!allFields.TryGetValue(st.IdField, out var sf))
                        continue;
                    var raw = GetPathValue(pathValues, st.Title);
                    StgFieldToDocumentMapper.ApplyValue(doc, sf.Name, raw);
                }

                if (string.IsNullOrWhiteSpace(doc.Name))
                    doc.Name = Path.GetFileNameWithoutExtension(fileName);

                var sub = BuildStorageSubPathByLogicalPath(relForMeta);
                await using var stream = item.File.OpenReadStream();
                var stored = await _storage.SaveFileAsync(stream, fileName, sub);
                doc.FilePath = stored;

                List<PdfPageDpiCalculator.PageDpiInfo>? pdfPageInfos = null;
                if (SearchablePdfDisplay.LooksLikePdf(ext, fileName, stored))
                {
                    var fullPdfPath = ResolveStoredFullPath(stored);
                    if (!string.IsNullOrEmpty(fullPdfPath) && File.Exists(fullPdfPath))
                    {
                        pdfPageInfos = PdfPageDpiCalculator.CalculateAllPages(fullPdfPath);
                        if (pdfPageInfos.Count > 0)
                        {
                            doc.PageCount = pdfPageInfos.Count;
                            var allDpi = pdfPageInfos
                                .SelectMany(x => new[] { x.DpiX, x.DpiY })
                                .Where(x => x > 0)
                                .ToList();
                            if (allDpi.Count > 0)
                            {
                                doc.MinDpi = allDpi.Min();
                                doc.MaxDpi = allDpi.Max();
                            }
                        }
                    }
                }

                doc.SearchMeta = string.Join(" ", new[]
                {
                    doc.Name, doc.SymbolNo, doc.RecordNo, doc.IssuedBy, doc.Author,
                    doc.Field1, doc.Field2, doc.Field3, doc.Field4, doc.Field5,
                    doc.Field6, doc.Field7, doc.Field8, doc.Field9, doc.Field10
                }.Where(x => !string.IsNullOrWhiteSpace(x)));

                var id = await _documents.InsertAsync(doc);

                if (pdfPageInfos is { Count: > 0 })
                {
                    var pages = pdfPageInfos.Select(x => new DocumentPage
                    {
                        DocumentId = id,
                        PageNumber = x.PageNumber,
                        DpiX = x.DpiX,
                        DpiY = x.DpiY,
                        PageSize = x.PageSize,
                        Created = DateTime.UtcNow
                    });
                    await _documentPages.InsertManyAsync(pages);
                }

                results.Add(new WebSyncUploadItemResult
                {
                    FileName = fn,
                    RelativePath = relForMeta,
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
                    RelativePath = relRaw,
                    Success = false,
                    Message = ex.Message
                });
            }
        }

        return new WebSyncUploadBatchResult { Items = results };
    }

    private static string BuildStorageSubPathByLogicalPath(string logicalRelativePath)
    {
        logicalRelativePath = logicalRelativePath.Trim().Replace('\\', '/');
        if (logicalRelativePath.Length == 0)
            return string.Empty;

        var dirOnly = Path.GetDirectoryName(logicalRelativePath.Replace('/', Path.DirectorySeparatorChar));
        if (string.IsNullOrWhiteSpace(dirOnly))
            return string.Empty;

        var parts = new List<string>();
        foreach (var seg in dirOnly.Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var s = SanitizePathSegment(seg);
            if (s.Length > 0 && s is not ("." or ".."))
                parts.Add(s);
        }

        return parts.Count == 0 ? string.Empty : Path.Combine(parts.ToArray());
    }

    private static string SanitizePathSegment(string seg)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(seg.Trim().Select(c => invalid.Contains(c) ? '_' : c));
    }

    private static string CombinePathPrefix(string? pathPrefix, string relativePath)
    {
        var rel = (relativePath ?? string.Empty).Trim().Replace('\\', '/').Trim('/');
        var prefix = (pathPrefix ?? string.Empty).Trim().Replace('\\', '/').Trim('/');
        if (string.IsNullOrWhiteSpace(prefix))
            return rel;
        if (string.IsNullOrWhiteSpace(rel))
            return prefix;
        if (rel.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase) || rel.Equals(prefix, StringComparison.OrdinalIgnoreCase))
            return rel;
        return prefix + "/" + rel;
    }

    private static DocTypeSyncListItemDto? ResolveSyncTypeForPath(string relativePath, IReadOnlyList<DocTypeSyncListItemDto> candidates)
    {
        var fileName = Path.GetFileName(relativePath.Replace('\\', '/'));

        // Rule ưu tiên theo tên file literal ở cuối format, ví dụ ".../BIA.pdf" (không phân biệt hoa thường).
        foreach (var sync in candidates.OrderBy(x => x.Weight).ThenBy(x => x.Id))
        {
            if (IsLiteralFileNamePatternMatch(fileName, sync.Format))
                return sync;
        }

        // Rule cho "{File_name}": nhận mọi file .pdf còn lại.
        foreach (var sync in candidates.OrderBy(x => x.Weight).ThenBy(x => x.Id))
        {
            if (IsFileNamePlaceholderPattern(sync.Format) && fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return sync;
        }

        // Fallback strict theo cấu trúc format.
        foreach (var sync in candidates.OrderBy(x => x.Weight).ThenBy(x => x.Id))
        {
            if (IsPathMatchingSyncFormat(relativePath, sync.Format))
                return sync;
        }
        return null;
    }

    private static bool IsLiteralFileNamePatternMatch(string fileName, string? format)
    {
        var formatSegments = SplitPathSegments((format ?? "").Replace('\\', '/'));
        if (formatSegments.Count == 0)
            return false;
        var tail = formatSegments[^1];
        if (IsPlaceholder(tail))
            return false;
        return tail.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
               && tail.Equals(fileName, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsFileNamePlaceholderPattern(string? format)
    {
        var formatSegments = SplitPathSegments((format ?? "").Replace('\\', '/'));
        if (formatSegments.Count == 0)
            return false;
        var tail = formatSegments[^1];
        return IsPlaceholder(tail) && tail[1..^1].Trim().Equals("File_name", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsPathMatchingSyncFormat(string relativePath, string? format)
    {
        var logical = BuildLogicalPathByFormat(relativePath, format);
        if (string.IsNullOrEmpty(logical))
            return false;

        var pathSegments = SplitPathSegments(logical);
        var formatSegments = SplitPathSegments((format ?? "").Replace('\\', '/'));
        if (pathSegments.Count == 0 || formatSegments.Count == 0 || pathSegments.Count < formatSegments.Count)
            return false;

        for (var i = 0; i < formatSegments.Count; i++)
        {
            var part = formatSegments[i];
            if (IsPlaceholder(part))
            {
                var name = part[1..^1].Trim();
                if (name.Equals("File_name", StringComparison.OrdinalIgnoreCase))
                {
                    if (i != formatSegments.Count - 1)
                        return false;
                    if (!pathSegments[i].EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        return false;
                }
                continue;
            }

            if (!part.Equals(pathSegments[i], StringComparison.OrdinalIgnoreCase))
                return false;
        }

        return true;
    }

    private static Dictionary<string, string?> ParseBySyncFormat(string? format, string logicalPath)
    {
        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var pathSegments = SplitPathSegments(logicalPath);
        var formatSegments = SplitPathSegments((format ?? "").Replace('\\', '/'));

        for (var i = 0; i < formatSegments.Count && i < pathSegments.Count; i++)
        {
            var segment = formatSegments[i];
            if (!IsPlaceholder(segment))
                continue;

            var key = segment[1..^1].Trim();
            if (key.Length == 0)
                continue;
            data[key] = pathSegments[i];
        }

        return data;
    }

    private static string BuildLogicalPathByFormat(string relativePath, DocTypeSyncListItemDto sync)
        => BuildLogicalPathByFormat(relativePath, sync.Format);

    private static string BuildLogicalPathByFormat(string relativePath, string? format)
    {
        var segments = SplitPathSegments(relativePath);
        var formatSegments = SplitPathSegments((format ?? "").Replace('\\', '/'));
        if (segments.Count == 0 || formatSegments.Count == 0)
            return relativePath.Replace('\\', '/');

        var rootLiteral = GetFirstLiteralSegment(format);
        var start = 0;
        if (!string.IsNullOrWhiteSpace(rootLiteral))
        {
            start = segments.FindIndex(x => x.Equals(rootLiteral, StringComparison.OrdinalIgnoreCase));
            if (start < 0)
                return string.Join("/", new[] { rootLiteral }.Concat(segments));
        }

        return string.Join("/", segments.Skip(start));
    }

    private static string? GetFirstLiteralSegment(string? format)
    {
        foreach (var segment in SplitPathSegments((format ?? "").Replace('\\', '/')))
        {
            if (!IsPlaceholder(segment))
                return segment;
        }
        return null;
    }

    private static bool IsPlaceholder(string segment)
        => segment.Length >= 3 && segment[0] == '{' && segment[^1] == '}';

    private static List<string> SplitPathSegments(string value)
    {
        return value.Trim()
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(Uri.UnescapeDataString)
            .ToList();
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

    private string? ResolveStoredFullPath(string? storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath))
            return null;
        var root = Path.GetFullPath(_storageOpt.RootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var combined = Path.GetFullPath(Path.Combine(root, storedPath.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)));
        var rootPrefix = root + Path.DirectorySeparatorChar;
        var ok = combined.Equals(root, StringComparison.OrdinalIgnoreCase)
                 || combined.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase);
        return ok ? combined : null;
    }
}
