param(
    [ValidateSet('web-mobile', 'wechatgame')][string]$Platform = 'web-mobile',
    [string]$AppId = '',
    [string]$CreatorExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
)
$ErrorActionPreference = 'Stop'
$validationDir = Split-Path -Parent $PSScriptRoot
$projectDir = Join-Path $validationDir 'project'
$evidenceDir = Join-Path $validationDir 'evidence'
if (!(Test-Path -LiteralPath $CreatorExe)) { throw 'Installed Creator not found; no automatic installation.' }
if ($AppId -and $AppId -notmatch '^wx[0-9a-fA-F]{16}$') { throw 'Invalid supplied AppID format.' }
$sourceConfig = if ($Platform -eq 'wechatgame') { 'build-wechat-local.json' } else { 'build-web.json' }
$config = Get-Content -Raw -LiteralPath (Join-Path $projectDir $sourceConfig) | ConvertFrom-Json
if ($Platform -eq 'wechatgame') { $config.packages.wechatgame.appid = $AppId }
$runtimeConfig = Join-Path $evidenceDir ('build-config-' + $Platform + '.json')
$config | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $runtimeConfig -Encoding utf8
$buildLog = Join-Path $evidenceDir ('creator-' + $Platform + '-build.log')
$creatorArgs = @('--project', ('"' + $projectDir + '"'), '--build', ('"configPath=' + $runtimeConfig + ';logDest=' + $buildLog + '"'))
$process = Start-Process -FilePath $CreatorExe -ArgumentList $creatorArgs -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $evidenceDir ('creator-' + $Platform + '.stdout.log')) `
    -RedirectStandardError (Join-Path $evidenceDir ('creator-' + $Platform + '.stderr.log'))
$process.WaitForExit()
$exitCode = $process.ExitCode
$exitCode | Set-Content -LiteralPath (Join-Path $evidenceDir ('creator-' + $Platform + '.exitcode'))
if ($exitCode -ne 36) { throw "Creator build did not report success (exit $exitCode). Inspect evidence logs." }
if ($Platform -eq 'wechatgame' -and !$AppId) {
    node (Join-Path $PSScriptRoot 'normalize-local-wechat.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Local AppID normalization failed.' }
}
Write-Output ('Built local package: ' + (Join-Path $projectDir ('build\' + $Platform)))
