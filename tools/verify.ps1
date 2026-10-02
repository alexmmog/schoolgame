param([switch]$BuildWeb)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
    node .\tools\test.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Rule/API verification failed.' }
    $probe = 'evidence\restart-probe-' + [guid]::NewGuid().ToString('N') + '.json'
    node .\tools\run-restart-probe.cjs write $probe
    if ($LASTEXITCODE -ne 0) { throw 'Restart write failed.' }
    node .\tools\run-restart-probe.cjs read $probe
    if ($LASTEXITCODE -ne 0) { throw 'Restart read failed.' }
    if ($BuildWeb) { & .\tools\build.ps1 -Platform web-mobile }
} finally { Pop-Location }
