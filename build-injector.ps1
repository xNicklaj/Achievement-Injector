# Recompiles flash/AchievementsMenuInjector.as into Skyrim/Data/interface/AchievementsMenuInjector.swf
# by replacing the class script inside the existing SWF with JPEXS FFDec (https://github.com/jindrapetrik/jpexs-decompiler).
# Needs ffdec-cli.exe on PATH, or pass -Ffdec. The SWF is edited in place (a .bak copy is kept next to it).
param(
    [string]$Ffdec = "ffdec-cli.exe",
    [string]$Script = "\__Packages\AchievementsMenuInjector"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$as   = Join-Path $root "flash\AchievementsMenuInjector.as"
$swf  = Join-Path $root "Skyrim\Data\interface\AchievementsMenuInjector.swf"
$out  = "$swf.new"

# FFDec's AS2 parser rejects `import` and return-type annotations; skse resolves as a global at runtime
$tmp = Join-Path $env:TEMP "AchievementsMenuInjector.as"
(Get-Content $as -Raw) -replace 'import skse;\s*', '' | Set-Content $tmp -Encoding ascii

Copy-Item $swf "$swf.bak" -Force
& $Ffdec -replace $swf $out $Script $tmp
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) {
    Write-Host "Replace failed. Script names in the SWF:"
    & $Ffdec -dumpAS2 $swf
    throw "ffdec failed (check -Script against the names above)"
}
Move-Item $out $swf -Force
Write-Host "Updated $swf"
