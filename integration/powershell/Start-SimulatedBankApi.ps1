[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('P629','P742','P815')][string]$BankId,
    [int]$Port = 0,
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)
$ErrorActionPreference='Stop'
$ProjectPath=(Resolve-Path -LiteralPath $ProjectPath).Path
$EnvFile=Join-Path $ProjectPath '.env'
if(-not(Test-Path -LiteralPath $EnvFile)){throw 'Project .env is missing. Configure the existing emulator environment first.'}
$EnvText=Get-Content -LiteralPath $EnvFile -Raw
if($EnvText -notmatch '(?m)^\s*USE_EMULATORS\s*=\s*true\s*(?:#.*)?$'){throw 'Refusing to start a simulated participant unless .env has USE_EMULATORS=true.'}
$Map=@{
 P629=@{Name='Nexus Bank';Project='demo-bank-p629';Ifsc='SRIR0A4N7WX';Port=3001}
 P742=@{Name='Meridian Bank';Project='demo-bank-p742';Ifsc='MERI0A7B2CD';Port=3002}
 P815=@{Name='Horizon Bank';Project='demo-bank-p815';Ifsc='HZON0R8T4K2';Port=3003}
}
$Bank=$Map[$BankId]
if($Port -le 0){$Port=$Bank.Port}
$env:BANK_ID=$BankId
$env:BANK_NAME=$Bank.Name
$env:BANK_IFSC=$Bank.Ifsc
$env:PRIVATE_FIREBASE_PROJECT_ID=$Bank.Project
$env:STORAGE_BUCKET="$($Bank.Project).appspot.com"
$env:PORT=[string]$Port
$env:NODE_ENV='development'
$env:USE_EMULATORS='true'
$env:X42_BASE_URL=''
$env:X42_BANK_SECRET=''
$env:X42_INTERNAL_TOKEN=''
Write-Host "Starting isolated synthetic participant $BankId ($($Bank.Name)) on port $Port using project $($Bank.Project)." -ForegroundColor Cyan
Write-Host 'This process does not activate the bank in X42 or configure an X42 endpoint.' -ForegroundColor Yellow
Push-Location $ProjectPath
try { & npm.cmd start; if($LASTEXITCODE -ne 0){throw "Bank API exited with code $LASTEXITCODE"} } finally { Pop-Location }
