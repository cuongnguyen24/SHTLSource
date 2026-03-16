using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Uploader.Security;

namespace Web.Uploader.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    private readonly IStorageService _storage;

    public UploadController(IStorageService storage)
    {
        _storage = storage;
    }

    /// <summary>Upload 1 file (multipart/form-data). Field name: file</summary>
    [HttpPost("file")]
    [ApiKeyAuth]
    [RequestSizeLimit(104857600)] // 100MB default; can be configured later
    public async Task<ActionResult<UploadFileResponse>> Upload([FromQuery] UploadFileRequest meta, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new UploadFileResponse { Success = false, Message = "File rỗng" });

        var ext = Path.GetExtension(file.FileName);
        var sub = Path.Combine(meta.ChannelId.ToString(), DateTime.UtcNow.ToString("yyyyMMdd"));

        await using var stream = file.OpenReadStream();
        var storedPath = await _storage.SaveFileAsync(stream, file.FileName, sub);
        var url = await _storage.GetPublicUrlAsync(storedPath);

        return Ok(new UploadFileResponse
        {
            Success = true,
            FileName = file.FileName,
            StoredPath = storedPath,
            FileSize = file.Length,
            Extension = ext,
            PublicUrl = url
        });
    }
}

