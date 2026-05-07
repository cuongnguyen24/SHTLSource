$root = Join-Path $PSScriptRoot "..\src\SHTL.App\Modules\Infrastructure\Data" | Resolve-Path
Get-ChildItem -Path $root -Recurse -Filter *.cs | ForEach-Object {
    if ($_.Name -eq "UserRepository.cs") { return }
    $t = [IO.File]::ReadAllText($_.FullName)
    $o = $t
    $t = $t.Replace("IDbConnectionFactory factory", "AppDbContext db")
    $t = $t.Replace(": base(factory)", ": base(db)")
    $t = $t.Replace("using var conn = _factory.CreateAccConnection();", "var conn = await OpenConnectionAsync();")
    $t = $t.Replace("using var conn = _factory.CreateCnfConnection();", "var conn = await OpenConnectionAsync();")
    $t = $t.Replace("using var conn = _factory.CreateStgConnection();", "var conn = await OpenConnectionAsync();")
    $t = $t.Replace("using var conn = _factory.CreateLogConnection();", "var conn = await OpenConnectionAsync();")
    $t = $t.Replace("using var conn = _factory.CreateMsgConnection();", "var conn = await OpenConnectionAsync();")
    $t = $t.Replace("using var conn = _factory.CreateCatalogConnection();", "var conn = await OpenConnectionAsync();")
    if ($t -ne $o) { [IO.File]::WriteAllText($_.FullName, $t) }
}
Write-Host "Bulk conn replace done"
