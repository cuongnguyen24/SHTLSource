using Core.Application.Services;
using Core.Domain.Contracts;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;
using Web.Uploader.Security;

namespace Web.Uploader.Controllers;

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
    /// Plugin / client gọi sau khi upload file xong để tạo Document. Header X-Api-Key = Uploader:ApiKey.
    /// </summary>
    [HttpPost("callback")]
    [ApiKeyAuth]
    public async Task<IActionResult> Callback([FromBody] UploadCallbackRequest req)
    {
        var user = _currentUser;
        if (user.Id == 0)
            user = new ServiceCurrentUser(req.ChannelId, req.CreatedBy != 0 ? req.CreatedBy : 1);

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
