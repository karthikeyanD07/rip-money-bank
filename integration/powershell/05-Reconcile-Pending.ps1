$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.env')) { throw 'Missing .env. Run 02-Configure-RIP.ps1 first.' }
npm.cmd run reconcile:pending
