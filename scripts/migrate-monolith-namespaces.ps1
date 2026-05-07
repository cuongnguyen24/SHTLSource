# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/migrate-monolith-namespaces.ps1
$root = Join-Path $PSScriptRoot "..\src\SHTL.App" | Resolve-Path
$replacements = @(
    @{ Old = "namespace Core.Domain"; New = "namespace SHTL.Modules.Core.Domain" },
    @{ Old = "using Core.Domain"; New = "using SHTL.Modules.Core.Domain" },
    @{ Old = "global::Core.Domain"; New = "global::SHTL.Modules.Core.Domain" },
    @{ Old = "namespace Core.Application"; New = "namespace SHTL.Modules.Core.Application" },
    @{ Old = "using Core.Application"; New = "using SHTL.Modules.Core.Application" },
    @{ Old = "global::Core.Application"; New = "global::SHTL.Modules.Core.Application" },
    @{ Old = "namespace Shared.Contracts"; New = "namespace SHTL.Modules.Shared.Contracts" },
    @{ Old = "using Shared.Contracts"; New = "using SHTL.Modules.Shared.Contracts" },
    @{ Old = "global::Shared.Contracts"; New = "global::SHTL.Modules.Shared.Contracts" },
    @{ Old = "namespace Infrastructure.Data"; New = "namespace SHTL.Modules.Infrastructure.Data" },
    @{ Old = "using Infrastructure.Data"; New = "using SHTL.Modules.Infrastructure.Data" },
    @{ Old = "namespace Infrastructure.Data.Repositories"; New = "namespace SHTL.Modules.Infrastructure.Data.Repositories" },
    @{ Old = "using Infrastructure.Data.Repositories"; New = "using SHTL.Modules.Infrastructure.Data.Repositories" },
    @{ Old = "namespace Infrastructure.Identity"; New = "namespace SHTL.Modules.Infrastructure.Identity" },
    @{ Old = "using Infrastructure.Identity"; New = "using SHTL.Modules.Infrastructure.Identity" },
    @{ Old = "namespace Infrastructure.Search"; New = "namespace SHTL.Modules.Infrastructure.Search" },
    @{ Old = "using Infrastructure.Search"; New = "using SHTL.Modules.Infrastructure.Search" },
    @{ Old = "namespace Infrastructure.Storage"; New = "namespace SHTL.Modules.Infrastructure.Storage" },
    @{ Old = "using Infrastructure.Storage"; New = "using SHTL.Modules.Infrastructure.Storage" },
    @{ Old = "namespace Web.Shared"; New = "namespace SHTL.Modules.Features.Shared" },
    @{ Old = "using Web.Shared"; New = "using SHTL.Modules.Features.Shared" },
    @{ Old = "namespace Web.Account"; New = "namespace SHTL.Modules.Features.Account" },
    @{ Old = "using Web.Account"; New = "using SHTL.Modules.Features.Account" },
    @{ Old = "namespace Web.Admin"; New = "namespace SHTL.Modules.Features.Admin" },
    @{ Old = "using Web.Admin"; New = "using SHTL.Modules.Features.Admin" },
    @{ Old = "namespace Web.Dashboard"; New = "namespace SHTL.Modules.Features.Dashboard" },
    @{ Old = "using Web.Dashboard"; New = "using SHTL.Modules.Features.Dashboard" },
    @{ Old = "namespace Web.SoHoa"; New = "namespace SHTL.Modules.Features.SoHoa" },
    @{ Old = "using Web.SoHoa"; New = "using SHTL.Modules.Features.SoHoa" },
    @{ Old = "namespace Web.Uploader"; New = "namespace SHTL.Modules.Features.Uploader" },
    @{ Old = "using Web.Uploader"; New = "using SHTL.Modules.Features.Uploader" },
    @{ Old = "namespace Service.Export"; New = "namespace SHTL.Modules.Features.Export" },
    @{ Old = "using Service.Export"; New = "using SHTL.Modules.Features.Export" }
)
Get-ChildItem -Path $root -Recurse -Include *.cs,*.cshtml,*.razor -File | ForEach-Object {
    $p = $_.FullName
    if ($p -match "\\(bin|obj)\\") { return }
    $t = [IO.File]::ReadAllText($p)
    $orig = $t
    foreach ($r in $replacements) {
        $t = $t.Replace($r.Old, $r.New)
    }
    # Fully-qualified leftovers (common patterns)
    $t = $t.Replace("Core.Domain.", "SHTL.Modules.Core.Domain.")
    $t = $t.Replace("Core.Application.", "SHTL.Modules.Core.Application.")
    $t = $t.Replace("Shared.Contracts.", "SHTL.Modules.Shared.Contracts.")
    $t = $t.Replace("Infrastructure.Data.", "SHTL.Modules.Infrastructure.Data.")
    $t = $t.Replace("Infrastructure.Identity.", "SHTL.Modules.Infrastructure.Identity.")
    $t = $t.Replace("Infrastructure.Search.", "SHTL.Modules.Infrastructure.Search.")
    $t = $t.Replace("Infrastructure.Storage.", "SHTL.Modules.Infrastructure.Storage.")
    $t = $t.Replace("Web.Shared.", "SHTL.Modules.Features.Shared.")
    $t = $t.Replace("Web.Account.", "SHTL.Modules.Features.Account.")
    $t = $t.Replace("Web.Admin.", "SHTL.Modules.Features.Admin.")
    $t = $t.Replace("Web.Dashboard.", "SHTL.Modules.Features.Dashboard.")
    $t = $t.Replace("Web.SoHoa.", "SHTL.Modules.Features.SoHoa.")
    $t = $t.Replace("Web.Uploader.", "SHTL.Modules.Features.Uploader.")
    $t = $t.Replace("Service.Export.", "SHTL.Modules.Features.Export.")
    if ($t -ne $orig) { [IO.File]::WriteAllText($p, $t) }
}
Write-Host "Done namespace migration under $root"
