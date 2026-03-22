using Microsoft.AspNetCore.Mvc;
using Web.Shared;

namespace Web.Admin.Controllers;

/// <summary>
/// Phiên bản cấu hình (export/import ZIP như AXE-Admin) — cần bảng + API riêng; hiện hiển thị hướng dẫn.
/// </summary>
public class ConfigVersionController : BaseAdminController
{
    public IActionResult Index()
    {
        SetPageHeader("Phiên bản cấu hình", "code-branch",
            new BreadcrumbItem { Text = "Tổng quan", Url = Url.Action("Index", "Home") },
            new BreadcrumbItem { Text = "Cấu hình thông số", Url = Url.Action("Index", "Config") },
            new BreadcrumbItem { Text = "Phiên bản cấu hình" });
        return View();
    }
}
