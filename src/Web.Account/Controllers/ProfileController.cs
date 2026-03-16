using Core.Domain.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Contracts.Dtos;

namespace Web.Account.Controllers;

[Authorize]
public class ProfileController : Controller
{
    private readonly ICurrentUser _currentUser;

    public ProfileController(ICurrentUser currentUser)
    {
        _currentUser = currentUser;
    }

    public IActionResult Index()
    {
        var vm = new ProfileVm
        {
            UserId = _currentUser.Id,
            ChannelId = _currentUser.ChannelId,
            UserName = _currentUser.UserName,
            FullName = _currentUser.FullName,
            Roles = _currentUser.Roles.ToList(),
            IsAdmin = _currentUser.IsAdmin
        };
        return View(vm);
    }
}

