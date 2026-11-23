# RIP Money Bank — X42 participant setup

This is a fresh codebase based on the original `firebase-bank-engine-master(1).zip`, not the previously generated RIP integration ZIP. The participant identity is preconfigured as RIP Money Bank / P661 / KART0M4N7CQ.

## What is included

- Bank-local customer authentication, KYC workflow, accounts, beneficiaries, balances, same-bank transfers, ledger, limits, portfolio and bank-local loans.
- X42 participant adapter: signed requests to the central switch, receiver-side X42 authentication, idempotent credits and sender-side status reconciliation.
- A separately deployable X42 switch reference/test harness under `central-switch/`. The X42 operator normally owns and deploys this service; RIP Money Bank does not need to deploy a second switch if the shared operator already provides one.
- PowerShell scripts for preflight, configuration, dependency installation, tests, API startup and pending-transfer reconciliation.

## PowerShell sequence

Run from the extracted `firebase-bank-engine-master` folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\integration\powershell\01-Preflight.ps1
.\integration\powershell\02-Configure-RIP.ps1
.\integration\powershell\03-Install-And-Test.ps1
```

After Firebase/X42 credentials and URLs arrive, fill the remaining values in `.env` using the secure values supplied by the respective owners. Do not paste service-account JSON or HMAC secrets into chat or commit them.

Start the bank API:

```powershell
.\integration\powershell\04-Start-Bank-Api.ps1
```

Reconcile pending interbank transactions after a timeout or from a scheduled task:

```powershell
.\integration\powershell\05-Reconcile-Pending.ps1
```

## X42 operator must do

1. Add RIP Money Bank with bank ID `P661`, IFSC `KART0M4N7CQ`, and the public HTTPS bank API base URL.
2. Provision one unique high-entropy secret for P661 in the X42 switch and provide the same secret securely to RIP Money Bank.
3. Ensure the shared directory contains the bank record and IFSC mapping, and grant RIP's service identity read access.
4. Run the X42 health check and activate P661 only after the bank API is publicly reachable.
5. Register and activate each other participating bank separately. Every participant must expose the compatible `/api/v1/interbank/credits` and `/api/v1/interbank/transfers/{transferId}` endpoints.

## Important boundaries

- The shared X42 medium is a multi-bank hub. Banks do not call one another directly.
- Customer, KYC, account, balance, ledger, loan and internal transfer records remain in each bank's private Firebase project.
- Loans are internal to the originating bank. No bank-to-bank loan workflow is implemented.
- Do not enable live cloud writes until the owner confirms the exact project, database and IAM permissions.
- This remains an educational integration baseline, not a regulated payment rail or production-certified banking system.
