using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Services.Axe;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Stg;
using SHTL.Modules.Infrastructure.Storage;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

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

                var orderedPathPlaceholders = GetOrderedPathPlaceholderEntries(matchedSync.Format, pathValues);
                foreach (var st in settings)
                {
                    if (st.IsCatalog)
                        continue;
                    if (!TryResolveDocFieldForSyncSetting(st, allFields, out var sf))
                        continue;
                    var raw = ResolvePathMetadataValue(pathValues, st, sf, orderedPathPlaceholders);
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
            var matches = Regex.Matches(segment, @"\{([^{}]+)\}");
            if (matches.Count == 0)
                continue;

            // Typical case: whole segment is one placeholder, e.g. "{Đợt số}"
            if (matches.Count == 1 && segment.Trim().Equals(matches[0].Value, StringComparison.Ordinal))
            {
                var key = matches[0].Groups[1].Value.Trim();
                if (key.Length > 0)
                    data[key] = pathSegments[i];
                continue;
            }

            // Legacy/mistyped format case: mixed tokens in one segment, e.g. "{Hồ sơ số}{File_name}".
            foreach (Match m in matches)
            {
                var key = m.Groups[1].Value.Trim();
                if (key.Length == 0) continue;
                if (key.Equals("File_name", StringComparison.OrdinalIgnoreCase))
                {
                    data[key] = pathSegments[^1];
                    continue;
                }
                if (!data.ContainsKey(key))
                    data[key] = pathSegments[i];
            }
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

    /// <summary>
    /// Thứ tự placeholder trong Format (bỏ File_name) để map Field 1..N khi tiêu đề cấu hình vẫn là "Field N".
    /// </summary>
    private static IReadOnlyList<(string Key, string? Value)> GetOrderedPathPlaceholderEntries(
        string? format,
        IReadOnlyDictionary<string, string?> pathValues)
    {
        var list = new List<(string Key, string?)>();
        foreach (var segment in SplitPathSegments((format ?? "").Replace('\\', '/')))
        {
            foreach (Match m in Regex.Matches(segment, @"\{([^{}]+)\}"))
            {
                var key = m.Groups[1].Value.Trim();
                if (key.Length == 0)
                    continue;
                if (key.Equals("File_name", StringComparison.OrdinalIgnoreCase))
                    continue;
                pathValues.TryGetValue(key, out var val);
                list.Add((key, val));
            }
        }

        return list;
    }

    /// <summary>
    /// Ghép giá trị từ path với cấu hình đồng bộ: Title khớp placeholder, gợi ý theo name chuẩn (levelno/boxno/recordno),
    /// sau đó map theo vị trí Field 1..25 nếu title vẫn là mặc định "Field N".
    /// </summary>
    private static string? ResolvePathMetadataValue(
        IReadOnlyDictionary<string, string?> pathValues,
        DocTypeSyncSettingDto st,
        StgDocFieldDto sf,
        IReadOnlyList<(string Key, string? Value)> orderedPlaceholders)
    {
        foreach (var title in new[] { st.Title, sf.Title })
        {
            var v = GetPathValue(pathValues, title);
            if (!string.IsNullOrWhiteSpace(v))
                return v;
        }

        // stg_doc_fields tên chuẩn sau migration — Format AXE thường dùng "Đợt số" thay vì "Tầng số"
        switch (sf.Name.ToLowerInvariant())
        {
            case "levelno":
                {
                    var v = GetPathValue(pathValues, "Đợt số") ?? GetPathValue(pathValues, "Tầng số");
                    if (!string.IsNullOrWhiteSpace(v))
                        return v;
                    break;
                }
            case "boxno":
                {
                    var v = GetPathValue(pathValues, "Hộp số");
                    if (!string.IsNullOrWhiteSpace(v))
                        return v;
                    break;
                }
            case "recordno":
                {
                    var v = GetPathValue(pathValues, "Hồ sơ số");
                    if (!string.IsNullOrWhiteSpace(v))
                        return v;
                    break;
                }
        }

        // Trường mở rộng (id 101–125 → field1–field25): nếu chưa match theo title, lấy theo thứ tự placeholder
        // trong Format (bỏ File_name) — tránh trường hợp DB chưa seed stg_doc_fields 101+ hoặc title lệch.
        if (sf.Id is >= 101 and <= 125)
        {
            var idx = ParseFieldNIndexFromName(sf.Name);
            if (idx >= 0 && idx < orderedPlaceholders.Count)
            {
                var val = orderedPlaceholders[idx].Value;
                if (!string.IsNullOrWhiteSpace(val))
                    return val;
            }
        }

        return null;
    }

    /// <summary>
    /// <c>stg_doc_type_sync_settings.id_field</c> cho Field 1–25 là 101–125. Nhiều DB chỉ seed <c>stg_doc_fields</c> 1–14,
    /// không có 101+ → lookup thất bại và metadata path không bao giờ được gán. Tổng hợp dòng catalog tối thiểu khi thiếu.
    /// </summary>
    private static bool TryResolveDocFieldForSyncSetting(
        DocTypeSyncSettingDto st,
        IReadOnlyDictionary<int, StgDocFieldDto> allFields,
        out StgDocFieldDto sf)
    {
        if (allFields.TryGetValue(st.IdField, out var found))
        {
            sf = found;
            return true;
        }

        if (st.IdField is >= 101 and <= 125)
        {
            var n = st.IdField - 100;
            sf = new StgDocFieldDto
            {
                Id = st.IdField,
                Name = $"field{n}",
                Title = st.Title ?? $"Field {n}",
                IsRequired = false,
                IsActive = true,
                IsRecord = false,
                Datatype = string.Empty,
                CClass = null
            };
            return true;
        }

        sf = null!;
        return false;
    }

    private static int ParseFieldNIndexFromName(string name)
    {
        var m = Regex.Match(name, @"^field(\d+)$", RegexOptions.IgnoreCase);
        return m.Success && int.TryParse(m.Groups[1].Value, out var n) ? n - 1 : -1;
    }

    private static string? GetPathValue(IReadOnlyDictionary<string, string?> pathValues, string? settingTitle)
    {
        if (string.IsNullOrWhiteSpace(settingTitle))
            return null;

        var keyRaw = settingTitle.Trim();
        if (pathValues.TryGetValue(keyRaw, out var v) && !string.IsNullOrWhiteSpace(v))
            return v;

        // Accept setting title saved as "{Tên placeholder}"
        var keyNoBrace = keyRaw.Trim('{', '}').Trim();
        if (pathValues.TryGetValue(keyNoBrace, out var vb) && !string.IsNullOrWhiteSpace(vb))
            return vb;

        // Loose compare: ignore case/space/diacritics so "Hộp Số" == "hop so"
        var normalizedTarget = NormalizeKey(keyNoBrace);
        var loose = pathValues.FirstOrDefault(kv => NormalizeKey(kv.Key) == normalizedTarget);
        if (!string.IsNullOrWhiteSpace(loose.Value))
            return loose.Value;

        // Backward fallback by exact (case-insensitive) compare
        var key = pathValues.Keys.FirstOrDefault(k => k.Equals(keyRaw, StringComparison.OrdinalIgnoreCase));
        if (key != null && !string.IsNullOrWhiteSpace(pathValues[key]))
            return pathValues[key];
        key = pathValues.Keys.FirstOrDefault(k => k.Equals(keyNoBrace, StringComparison.OrdinalIgnoreCase));
        if (key != null && !string.IsNullOrWhiteSpace(pathValues[key]))
            return pathValues[key];

        return null;
    }

    private static string NormalizeKey(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;
        var s = input.Trim().ToLowerInvariant();
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s.Normalize(NormalizationForm.FormD))
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (uc == UnicodeCategory.NonSpacingMark)
                continue;
            if (char.IsWhiteSpace(ch) || ch == '_' || ch == '-')
                continue;
            sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
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
