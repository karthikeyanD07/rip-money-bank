[CmdletBinding()]
param([string]$ProjectPath=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)
$ErrorActionPreference='Stop'
$ProjectPath=(Resolve-Path -LiteralPath $ProjectPath).Path
$EnvFile=Join-Path $ProjectPath '.env'
if(-not(Test-Path -LiteralPath $EnvFile)){throw 'Missing .env. The patch does not create or replace environment secrets.'}
$EnvText=Get-Content -LiteralPath $EnvFile -Raw
if($EnvText -notmatch '(?m)^\s*USE_EMULATORS\s*=\s*true\s*(?:#.*)?$'){throw 'Seed blocked: .env must set USE_EMULATORS=true.'}
function Test-Port([string]$HostName,[int]$Port){$client=New-Object System.Net.Sockets.TcpClient;try{$result=$client.BeginConnect($HostName,$Port,$null,$null);if(-not $result.AsyncWaitHandle.WaitOne(1500,$false)){return $false};$client.EndConnect($result);return $true}catch{return $false}finally{$client.Close()}}
foreach($Port in @(8080,8180)){if(-not(Test-Port '127.0.0.1' $Port)){throw "Firestore emulator port $Port is not reachable. Start private (8080) and shared (8180) emulator terminals first."}}
Push-Location $ProjectPath
try {
 Write-Host '[1/2] Seeding four isolated synthetic bank datasets and inactive shared directory entries…' -ForegroundColor Cyan
 & npm.cmd run seed:platform
 if($LASTEXITCODE -ne 0){throw "Synthetic seed failed with exit code $LASTEXITCODE. Stop here and inspect the error."}
 Write-Host '[2/2] Verifying counts, ownership and ledger-to-balance reconciliation…' -ForegroundColor Cyan
 & npm.cmd run verify:seed
 if($LASTEXITCODE -ne 0){throw "Seed verification failed with exit code $LASTEXITCODE. Do not continue to frontend testing."}
} finally {Pop-Location}
Write-Host 'PASS: synthetic bank population and reconciliation verification completed.' -ForegroundColor Green
