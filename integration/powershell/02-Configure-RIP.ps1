param(
  [string]$PrivateProjectId,
  [string]$SharedProjectId,
  [string]$X42BaseUrl,
  [switch]$UseCloud
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
$content = Get-Content '.env' -Raw
$content = $content -replace '(?m)^BANK_ID=.*$', 'BANK_ID=P661'
$content = $content -replace '(?m)^BANK_NAME=.*$', 'BANK_NAME=RIP Money Bank'
$content = $content -replace '(?m)^BANK_IFSC=.*$', 'BANK_IFSC=KART0M4N7CQ'
if (-not $PrivateProjectId) { $PrivateProjectId = Read-Host 'RIP Money Bank private Firebase Project ID' }
if (-not $SharedProjectId) { $SharedProjectId = Read-Host 'Shared X42 Firebase Project ID (leave blank if not received yet)' }
if (-not $X42BaseUrl) { $X42BaseUrl = Read-Host 'X42 public HTTPS base URL (leave blank if not received yet)' }
if ($PrivateProjectId) { $content = $content -replace '(?m)^PRIVATE_FIREBASE_PROJECT_ID=.*$', "PRIVATE_FIREBASE_PROJECT_ID=$PrivateProjectId" }
if ($SharedProjectId) { $content = $content -replace '(?m)^SHARED_FIREBASE_PROJECT_ID=.*$', "SHARED_FIREBASE_PROJECT_ID=$SharedProjectId" }
if ($X42BaseUrl) { $content = $content -replace '(?m)^X42_BASE_URL=.*$', "X42_BASE_URL=$X42BaseUrl" }
if ($UseCloud) { $content = $content -replace '(?m)^USE_EMULATORS=.*$', 'USE_EMULATORS=false'; $content = $content -replace '(?m)^COOKIE_SECURE=.*$', 'COOKIE_SECURE=true'; $content = $content -replace '(?m)^NODE_ENV=.*$', 'NODE_ENV=production' }
$fullPath = Join-Path (Get-Location) '.env'
[System.IO.File]::WriteAllText($fullPath, $content, ([System.Text.UTF8Encoding]::new($false)))
Write-Host 'RIP identity configured. Verify the project IDs before using cloud credentials.' -ForegroundColor Green
Write-Host 'Set X42_BANK_SECRET and PEER_SHARED_SECRETS_JSON securely in .env after the X42 operator issues the P661 secret.'
