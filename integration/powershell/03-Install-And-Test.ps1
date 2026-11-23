$ErrorActionPreference = 'Stop'
Write-Host 'Installing RIP Money Bank dependencies...' -ForegroundColor Cyan
npm.cmd ci
npm.cmd install --no-save nodemailer
Write-Host 'Checking and testing bank participant...' -ForegroundColor Cyan
npm.cmd run verify
Write-Host 'Installing X42 switch reference/test-harness dependencies...' -ForegroundColor Cyan
Push-Location 'central-switch'
try {
  npm.cmd install
  npm.cmd run check
  npm.cmd test
} finally { Pop-Location }
Write-Host 'All local verification steps completed.' -ForegroundColor Green
