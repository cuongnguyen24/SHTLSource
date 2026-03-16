using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.ResumableUploader.Security;

namespace Web.ResumableUploader.Controllers;

[ApiController]
[Route("api/resumable")]
public class ResumableController : ControllerBase
{
    private readonly IConfiguration _cfg;
    private readonly IStorageService _storage;

    public ResumableController(IConfiguration cfg, IStorageService storage)
    {
        _cfg = cfg;
        _storage = storage;
    }

    [HttpPost("init")]
    [ApiKeyAuth]
    public ActionResult<ResumableInitResponse> Init([FromBody] ResumableInitRequest req)
    {
        var tempRoot = GetTempRoot();
        Directory.CreateDirectory(tempRoot);

        var fileId = string.IsNullOrWhiteSpace(req.FileId) ? Guid.NewGuid().ToString("N") : req.FileId.Trim();
        var dir = GetTempDir(req.ChannelId, fileId);
        Directory.CreateDirectory(dir);

        System.IO.File.WriteAllText(Path.Combine(dir, "_meta.json"),
            System.Text.Json.JsonSerializer.Serialize(req));

        return Ok(new ResumableInitResponse { Success = true, FileId = fileId });
    }

    /// <summary>
    /// Upload a chunk: multipart/form-data field name: chunk
    /// Query: channelId, fileId, chunkIndex (0-based)
    /// </summary>
    [HttpPost("chunk")]
    [ApiKeyAuth]
    [RequestSizeLimit(1073741824)] // up to 1GB per request (client controls chunk size)
    public async Task<IActionResult> UploadChunk([FromQuery] int channelId, [FromQuery] string fileId, [FromQuery] int chunkIndex, IFormFile chunk)
    {
        if (chunk == null || chunk.Length == 0) return BadRequest(new { success = false, message = "Chunk rỗng" });
        if (string.IsNullOrWhiteSpace(fileId)) return BadRequest(new { success = false, message = "FileId thiếu" });
        if (chunkIndex < 0) return BadRequest(new { success = false, message = "ChunkIndex không hợp lệ" });

        var dir = GetTempDir(channelId, fileId);
        Directory.CreateDirectory(dir);

        var chunkPath = Path.Combine(dir, $"{chunkIndex:D8}.part");
        await using var fs = new FileStream(chunkPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await chunk.CopyToAsync(fs);

        return Ok(new { success = true, chunkIndex });
    }

    [HttpPost("complete")]
    [ApiKeyAuth]
    public async Task<ActionResult<ResumableCompleteResponse>> Complete([FromBody] ResumableCompleteRequest req)
    {
        var dir = GetTempDir(req.ChannelId, req.FileId);
        if (!Directory.Exists(dir))
            return BadRequest(new ResumableCompleteResponse { Success = false, Message = "Không tìm thấy upload session" });

        if (req.TotalChunks <= 0)
            return BadRequest(new ResumableCompleteResponse { Success = false, Message = "TotalChunks không hợp lệ" });

        // Validate chunks exist
        for (var i = 0; i < req.TotalChunks; i++)
        {
            var p = Path.Combine(dir, $"{i:D8}.part");
            if (!System.IO.File.Exists(p))
                return BadRequest(new ResumableCompleteResponse { Success = false, Message = $"Thiếu chunk {i}" });
        }

        // Assemble to a temp file
        var assembledPath = Path.Combine(dir, "_assembled.tmp");
        await using (var outStream = new FileStream(assembledPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            for (var i = 0; i < req.TotalChunks; i++)
            {
                var p = Path.Combine(dir, $"{i:D8}.part");
                await using var inStream = new FileStream(p, FileMode.Open, FileAccess.Read, FileShare.Read);
                await inStream.CopyToAsync(outStream);
            }
        }

        var fi = new FileInfo(assembledPath);
        if (req.FileSize > 0 && fi.Length != req.FileSize)
            return BadRequest(new ResumableCompleteResponse { Success = false, Message = $"Size mismatch. Expect {req.FileSize}, got {fi.Length}" });

        // Store into storage
        var sub = Path.Combine(req.ChannelId.ToString(), DateTime.UtcNow.ToString("yyyyMMdd"));
        await using var assembledStream = new FileStream(assembledPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var storedPath = await _storage.SaveFileAsync(assembledStream, req.FileName, sub);
        var url = await _storage.GetPublicUrlAsync(storedPath);

        // Cleanup best-effort
        try { Directory.Delete(dir, true); } catch { /* ignore */ }

        return Ok(new ResumableCompleteResponse
        {
            Success = true,
            StoredPath = storedPath,
            PublicUrl = url,
            FileSize = fi.Length
        });
    }

    private string GetTempRoot()
        => _cfg["Resumable:TempPath"] ?? Path.Combine(Path.GetTempPath(), "shtl_resumable");

    private string GetTempDir(int channelId, string fileId)
        => Path.Combine(GetTempRoot(), channelId.ToString(), fileId);
}

