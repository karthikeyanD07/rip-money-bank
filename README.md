# Bank Management Backend — PDF-aligned implementation

Version **2.1.0**. RIP Money Bank participant backend based on `Bank_Management_DB_Design.pdf` and the X42 multi-bank switch build plan.

## Architecture

- **Shared X42 Firebase project:** `banks`, `ifsc_registry` and `switch_nonces`. It contains network directory and replay-protection metadata only; no customer credentials, KYC, accounts, balances, loans or bank-private ledgers.
- **One private Firebase project per bank:** users, sessions, KYC, accounts, beneficiaries, transfers, ledger entries, limits, daily usage, idempotency, interbank inbox, loans, portfolio, notification outbox and audit logs.
- **Interbank:** every participant sends signed HTTPS requests to the central X42 switch. X42 routes to the destination bank; banks do not call one another directly. X42 records routing status; each bank retains its private transfer, hold and ledger records.
- **X42:** private-bank balance API. Money is integer paise. Available balance is posted minus held.
- **Security:** Firestore and Storage client rules deny all access. Trusted Node.js backend uses Admin SDK and checks UID, role and ownership.

## Requirements

- Node.js 24.12.0+
- Firebase CLI (for emulator and Firebase administration)
- `argon2` for Argon2id password hashing (included in dependencies)
- `nodemailer` only if SMTP notifications are enabled

Argon2 is intentionally fail-closed: the authentication adapter will not silently fall back to a weaker hash if the native module is unavailable.

## Windows PowerShell setup

Extract the ZIP and open PowerShell in the `firebase-bank-engine-master` folder. Use the included scripts rather than manually editing source files:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\integration\powershell\01-Preflight.ps1
.\integration\powershell\02-Configure-RIP.ps1
.\integration\powershell\03-Install-And-Test.ps1
```

The default configuration is emulator mode. To configure a real Firebase environment after the project IDs and credentials have been issued, use `02-Configure-RIP.ps1 -UseCloud` and fill the service-account paths, Storage bucket, X42 URL and P661 secret in `.env`. Never put credentials in the ZIP or source control.

For local testing, start the private bank emulators and shared X42 directory emulator in separate terminals:

```powershell
npm.cmd run emulators
```

```powershell
npm.cmd run emulators:shared
```

Then start the bank API in another terminal and provision the bank admin in a separate terminal:

```powershell
.\integration\powershell\04-Start-Bank-Api.ps1
```

```powershell
npm.cmd run provision-admin
```

Private Auth/Firestore/Storage use ports 9099/8080/9199; shared X42 directory Firestore uses port 8180. These emulators are isolated by project ID.

## Shared X42 directory

The X42 operator owns the shared directory. Do not run `seed:directory` or use a directory-maintainer credential from the RIP bank participant. The operator registers RIP Money Bank (P661 / KART0M4N7CQ), provides the public HTTPS bank API URL, provisions the P661 secret and activates the bank after the health check succeeds. The bank participant only needs read access to the shared directory and write access to its own private Firebase project.

## API server

The API routes are listed in `docs/API-ROUTES.md`; sample requests are in `api/sample_calls.http`. Login returns an HttpOnly `bank_session` cookie and a CSRF token. Send `X-CSRF-Token` on state-changing browser requests. Supply `Idempotency-Key` for transfer requests.

## X42 participant configuration

Set `X42_BASE_URL` and `X42_BANK_SECRET` out-of-band. The same unique high-entropy secret must be provisioned for this bank ID in the X42 switch and as the X42 caller secret in `PEER_SHARED_SECRETS_JSON`. Never put secrets in the shared directory or ZIP. Rotate keys using a controlled overlap procedure. Interbank transfers remain PENDING until the sender reconciles the X42 transaction status; run `npm.cmd run reconcile:pending` on a schedule or after a transfer timeout.

## Tests

```powershell
npm.cmd run verify
```

The automated tests use a deterministic in-memory Firestore adapter and mocked HTTP. They verify internal transfers, loan disbursement/repayment, X42 signing, destination validation, routing, receiver idempotency and status reconciliation. They are not a substitute for real Firebase Emulator integration or a two-bank live HTTP integration test.

## Scope and limitations

See `docs/IMPLEMENTATION-STATUS.md` and the three checklists in `checklists/`. This is a backend-only sandbox implementation, not a production banking system. It does not connect to payment rails, perform regulatory identity verification, provide HSM-backed key management, implement interbank reversal/compensation, or guarantee production-grade operational resilience. The ₹1,000 opening amount is synthetic assignment data only.

## Platform frontend and populated local banking ecosystem

The optional `frontend/` directory contains the React/Vite customer and admin portal. The API remains authoritative; browser requests use the backend session cookie and CSRF token. See `PATCH-INSTALL.md` and `docs/PLATFORM-IMPLEMENTATION.md` for installation, synthetic dataset volumes, seed verification and X42 limitations.

For a local-only synthetic four-bank environment, start the private and shared Firestore emulators and run:

```powershell
npm.cmd run seed:platform
npm.cmd run verify:seed
```

The seed refuses non-emulator use. Simulated external participants remain inactive and have no API endpoint until real X42 configuration and explicit activation are available.
