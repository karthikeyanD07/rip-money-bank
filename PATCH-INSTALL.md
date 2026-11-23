# Apply RIP Money Bank platform patch

This is an overlay patch for the existing RIP Money Bank v2.1.0 codebase. It does not replace the project.

## 1. Extract the patch ZIP

Extract the patch ZIP to a working folder, for example `C:\RIP-Platform-Patch`.

## 2. Apply with a checkpoint

Open Windows PowerShell 5.1 and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\Apply-RIPPlatformPatch.ps1 -ProjectPath 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine'
```

The script checks the project version, verifies every payload SHA-256, creates a timestamped backup of overwritten files, copies only payload files, preserves `.env`, credentials, `.git`, `node_modules`, and emulator data, and runs backend syntax/unit verification. It stops on the first failure.

## 3. Install frontend dependencies and verify its production build

```powershell
Set-Location 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine\frontend'
npm.cmd install
npm.cmd run test
npm.cmd run build
# Or use the guarded frontend installer from the project root:
..\integration\powershell\Install-Verify-Frontend.ps1
```

## 4. Start emulators and seed the four banks

Keep the private and shared emulator terminals running:

```powershell
# Terminal 1 — private P661 Auth/Firestore/Storage
Set-Location 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine'
npm.cmd run emulators
```

```powershell
# Terminal 2 — shared X42 directory Firestore
Set-Location 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine'
npm.cmd run emulators:shared
```

Then, in a third terminal:

```powershell
Set-Location 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine'
npm.cmd run seed:platform
# Or use the guarded checkpoint script:
.\integration\powershell\Seed-And-Verify-RIPPlatform.ps1
```

**Checkpoint:** the command must print `status: complete` and list all four banks. If it fails, stop and share the complete error; do not continue to the next stage.

```powershell
npm.cmd run verify:seed
```

**Checkpoint:** require `status: passed`, expected customer/account/activity counts, and `ledgerReconciled: true` for all four banks. All simulated directory banks must remain `INACTIVE` with `apiBaseUrl: null`.

## 5. Verify backend and start services

```powershell
npm.cmd run verify
```

**Checkpoint:** require zero syntax errors and zero failed tests.

Terminal 3:

```powershell
npm.cmd start
```

Terminal 4:

```powershell
Set-Location 'C:\Users\karthikeyan.devipras\OneDrive - psiog.com\Documents\firebase-bank-engine\frontend'
npm.cmd install
npm.cmd run test
npm.cmd run build
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://127.0.0.1:3000`, so the browser uses same-origin API calls and the backend's existing cookie/CSRF model.

To run isolated local API processes for the synthetic external banks, use one PowerShell terminal per bank:

```powershell
.\integration\powershell\Start-SimulatedBankApi.ps1 -BankId P629
.\integration\powershell\Start-SimulatedBankApi.ps1 -BankId P742
.\integration\powershell\Start-SimulatedBankApi.ps1 -BankId P815
```

These use ports 3001, 3002 and 3003. Each process points to a different private Firestore emulator project. They do not activate the participants in the shared directory or enable X42 transfers.

## 6. Test customer access

Example P661 synthetic customer:

- Email: `p661.customer0001@example.test`
- Password: `DemoBank#2026!`

This is an emulator-only credential. Never reuse it in a real environment.

Admin users are not provisioned by this patch. Do not create or activate an administrator without the bank owner's explicit approval.

## Safety and scope

- The seed script refuses to run unless `USE_EMULATORS=true` and `NODE_ENV` is not `production`.
- Private customer datasets are written to separate Firestore emulator project IDs; only bank directory metadata is shared.
- No production Firebase project is touched.
- P661 and all synthetic external banks remain inactive. No real X42 URL or secrets are generated.
- Synthetic interbank beneficiaries are reference data only. Interbank transfer submission will remain blocked until real X42 connectivity and bank activation are verified.
