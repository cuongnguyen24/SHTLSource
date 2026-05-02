$root = Join-Path $PSScriptRoot "..\src\SHTL.App" | Resolve-Path
Get-ChildItem -Path $root -Recurse -Include *.cs,*.cshtml,*.razor -File | ForEach-Object {
    if ($_.FullName -match '\\bin\\|\\obj\\') { return }
    $c = [IO.File]::ReadAllText($_.FullName)
    $n = $c
    do {
        $prev = $n
        $n = $n.Replace('SHTL.Modules.SHTL.Modules.', 'SHTL.Modules.')
    } while ($n -ne $prev)
    if ($n -ne $c) { [IO.File]::WriteAllText($_.FullName, $n) }
}
Write-Host "Fixed doubles under $root"
