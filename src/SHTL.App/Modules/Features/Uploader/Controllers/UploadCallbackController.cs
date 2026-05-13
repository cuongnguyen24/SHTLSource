using Microsoft.AspNetCore.Mvc;
using SHTL.Modules.Core.Application.Services;
using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Features.Uploader.Security;
using SHTL.Modules.Shared.Contracts.Dtos;
using System.Collections.Concurrent;

namespace SHTL.Modules.Features.Uploader.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadCallbackController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> ChunkLocks = new(StringComparer.OrdinalIgnoreCase);
    private readonly IDocumentService _docService;
    private readonly ICurrentUser _currentUser;
    private readonly IDocumentSyncUploadService _syncUploadService;

    public UploadCallbackController(
        IDocumentService docService,
        ICurrentUser currentUser,
        IDocumentSyncUploadService syncUploadService)
    {
        _docService = docService;
        _currentUser = currentUser;
        _syncUploadService = syncUploadService;
    }

    /// <summary>
    /// Plugin / client gọi sau khi upload file xong để tạo Document. Header X-Api-Key = Uploader:ApiKey.
    /// </summary>
    [HttpPost("callback")]
    [ApiKeyAuth]
    public async Task<IActionResult> Callback([FromBody] UploadCallbackRequest req)
    {
        var user = _currentUser;
        if (user.Id == 0)
            user = new ServiceCurrentUser(req.CreatedBy != 0 ? req.CreatedBy : 1);

        var result = await _docService.CreateFromUploadAsync(req, user);
        return Ok(result);
    }

    [HttpPost("plugin-sync")]
    [ApiKeyAuth]
    [RequestSizeLimit(long.MaxValue)]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public async Task<IActionResult> PluginSyncUpload(
        [FromForm] List<int> syncTypeIds,
        [FromForm] bool onlyPdf,
        [FromForm] int createdBy,
        CancellationToken cancellationToken)
    {
        var posted = Request.Form.Files
            .Where(f => string.Equals(f.Name, "files", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var paths = Request.Form["relativePaths"];

        var items = new List<SyncUploadFormFile>(posted.Count);
        for (var i = 0; i < posted.Count; i++)
        {
            var p = i < paths.Count ? paths[i]!.ToString() : posted[i].FileName;
            items.Add(new SyncUploadFormFile
            {
                File = posted[i],
                RelativePath = string.IsNullOrWhiteSpace(p) ? posted[i].FileName : p
            });
        }

        var userId = createdBy > 0 ? createdBy : 1;
        var result = await _syncUploadService.UploadAsync(
            userId,
            syncTypeIds ?? new List<int>(),
            items,
            onlyPdf,
            pathPrefix: null,
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("plugin-sync-chunk")]
    [ApiKeyAuth]
    [RequestSizeLimit(long.MaxValue)]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public async Task<IActionResult> PluginSyncUploadChunk(
        [FromForm] string uploadId,
        [FromForm] string fileName,
        [FromForm] string relativePath,
        [FromForm] int chunkIndex,
        [FromForm] int totalChunks,
        [FromForm] List<int> syncTypeIds,
        [FromForm] bool onlyPdf,
        [FromForm] int createdBy,
        [FromForm] IFormFile chunk,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(uploadId) || string.IsNullOrWhiteSpace(fileName) || totalChunks <= 0 || chunk is null || chunk.Length <= 0)
            return BadRequest(new { completed = false, message = "Invalid chunk request" });

        var safeUploadId = string.Concat(uploadId.Where(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_'));
        if (string.IsNullOrWhiteSpace(safeUploadId))
            return BadRequest(new { completed = false, message = "Invalid uploadId" });

        var chunkRoot = Path.Combine(Path.GetTempPath(), "shtl-plugin-sync", safeUploadId);
        Directory.CreateDirectory(chunkRoot);
        var dataPath = Path.Combine(chunkRoot, "data.bin");
        var metaPath = Path.Combine(chunkRoot, "meta.txt");

        var locker = ChunkLocks.GetOrAdd(safeUploadId, _ => new SemaphoreSlim(1, 1));
        await locker.WaitAsync(cancellationToken);
        try
        {
            var mode = chunkIndex == 0 ? FileMode.Create : FileMode.Append;
            await using (var fs = new FileStream(dataPath, mode, FileAccess.Write, FileShare.None))
            await using (var cs = chunk.OpenReadStream())
            {
                await cs.CopyToAsync(fs, cancellationToken);
            }

            if (chunkIndex == 0)
            {
                await System.IO.File.WriteAllTextAsync(metaPath, relativePath ?? fileName, cancellationToken);
            }
        }
        finally
        {
            locker.Release();
        }

        if (chunkIndex < totalChunks - 1)
            return Ok(new { completed = false });

        try
        {
            var rel = System.IO.File.Exists(metaPath)
                ? await System.IO.File.ReadAllTextAsync(metaPath, cancellationToken)
                : (relativePath ?? fileName);

            await using var stream = new FileStream(dataPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            var formFile = new FormFile(stream, 0, stream.Length, "files", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/octet-stream"
            };

            var items = new List<SyncUploadFormFile>
            {
                new() { File = formFile, RelativePath = string.IsNullOrWhiteSpace(rel) ? fileName : rel }
            };

            var userId = createdBy > 0 ? createdBy : 1;
            var result = await _syncUploadService.UploadAsync(
                userId,
                syncTypeIds ?? new List<int>(),
                items,
                onlyPdf,
                pathPrefix: null,
                cancellationToken);

            return Ok(new { completed = true, result });
        }
        finally
        {
            try
            {
                if (Directory.Exists(chunkRoot))
                    Directory.Delete(chunkRoot, true);
            }
            catch { }

            if (ChunkLocks.TryRemove(safeUploadId, out var sem))
                sem.Dispose();
        }
    }
}

file sealed class ServiceCurrentUser(int userId) : ICurrentUser
{
    public int Id => userId;
    public string UserName => "service";
    public string FullName => "Service Account";
    public bool IsAdmin => true;
    public IEnumerable<string> Roles => new[] { "admin" };
    public bool HasPermission(string module) => true;
}
