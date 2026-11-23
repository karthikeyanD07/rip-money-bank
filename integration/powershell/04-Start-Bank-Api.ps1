$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.env')) { throw 'Missing .env. Run 02-Configure-RIP.ps1 first.' }
if (-not (Test-Path 'node_modules')) { throw 'Dependencies missing. Run 03-Install-And-Test.ps1 first.' }
npm.cmd run start
