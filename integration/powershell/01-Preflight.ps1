$ErrorActionPreference = 'Stop'
Write-Host 'RIP Money Bank / X42 integration preflight' -ForegroundColor Cyan
$node = (node --version).TrimStart('v')
$nodeVersion = [version]$node
if ($nodeVersion -lt [version]'24.12.0') { throw "Node.js 24.12.0 or later is required. Found $node. Install Node.js 24 LTS and reopen PowerShell." }
$npmVersion = npm --version
Write-Host "Node.js: $node"
Write-Host "npm: $npmVersion"
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { Write-Warning 'Firebase CLI not found. Install with: npm install -g firebase-tools' }
if (-not (Test-Path '.env')) { Write-Warning '.env is not configured yet. Run 02-Configure-RIP.ps1.' }
Write-Host 'Preflight completed.' -ForegroundColor Green
