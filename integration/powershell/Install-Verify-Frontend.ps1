[CmdletBinding()]
param([string]$ProjectPath=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)
$ErrorActionPreference='Stop'
$ProjectPath=(Resolve-Path -LiteralPath $ProjectPath).Path
$Frontend=Join-Path $ProjectPath 'frontend'
if(-not(Test-Path -LiteralPath (Join-Path $Frontend 'package.json'))){throw 'Frontend package.json is missing. Apply the platform patch first.'}
Push-Location $Frontend
try {
 Write-Host '[1/3] Installing frontend dependencies…' -ForegroundColor Cyan
 & npm.cmd install
 if($LASTEXITCODE -ne 0){throw "npm install failed with exit code $LASTEXITCODE"}
 Write-Host '[2/3] Running frontend unit tests…' -ForegroundColor Cyan
 & npm.cmd run test
 if($LASTEXITCODE -ne 0){throw "Frontend tests failed with exit code $LASTEXITCODE"}
 Write-Host '[3/3] Building production frontend…' -ForegroundColor Cyan
 & npm.cmd run build
 if($LASTEXITCODE -ne 0){throw "Frontend build failed with exit code $LASTEXITCODE"}
} finally {Pop-Location}
Write-Host 'PASS: frontend dependencies, tests and production build verified.' -ForegroundColor Green
