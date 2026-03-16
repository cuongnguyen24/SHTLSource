using Api.Gateway.Security;
using Core.Application.Services;
using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Api.Gateway.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadCallbackController : ControllerBase
{
    private readonly IDocumentService _docService;
    private readonly ICurrentUser _currentUser;

    public UploadCallbackController(IDocumentService docService, ICurrentUser currentUser)
    {
        _docService = docService;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Web.Uploader/Plugin gọi endpoint này để tạo Document sau khi upload xong.
    /// Bảo mật bằng X-Api-Key.
    /// </summary>
    [HttpPost("callback")]
    [ApiKeyAuth]
    public async Task<IActionResult> Callback([FromBody] UploadCallbackRequest req)
    {
        // Nếu chạy theo mode "service callback" (không có cookie), CurrentUser sẽ rỗng.
        // Tạm thời: cho phép truyền CreatedBy trong req (nếu 0 thì fallback 1).
        // TODO: thay bằng JWT/service account.
        var user = _currentUser;
        if (user.Id == 0)
        {
            user = new ServiceCurrentUser(req.ChannelId, req.CreatedBy != 0 ? req.CreatedBy : 1);
        }

        var result = await _docService.CreateFromUploadAsync(req, user);
        return Ok(result);
    }
}

file sealed class ServiceCurrentUser(int channelId, int userId) : ICurrentUser
{
    public int Id => userId;
    public int ChannelId => channelId;
    public string UserName => "service";
    public string FullName => "Service Account";
    public bool IsAdmin => true;
    public IEnumerable<string> Roles => new[] { "admin" };
    public bool HasPermission(string module) => true;
}

