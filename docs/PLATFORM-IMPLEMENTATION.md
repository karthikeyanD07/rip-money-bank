# RIP Money Bank platform patch — synthetic ecosystem and web frontend

## What this patch adds

- A React/Vite customer and bank-operations frontend in `frontend/`.
- Same-origin `/api` proxy in Vite to the existing bank API at `127.0.0.1:3000`.
- Browser API client using the existing HttpOnly `bank_session` cookie and CSRF token; no bearer token or private Firestore access from the browser.
- Read-only admin endpoints for dashboard, customer, account, transaction, loan and audit views; customer transaction and KYC status endpoints.
- Emulator-only deterministic synthetic seed for four isolated private Firestore project IDs and a shared inactive bank directory.
- Seed verification for customer/account counts, ledger-to-balance reconciliation and inactive network participant state.

## Synthetic bank population

| Bank | Project ID | Customers | Accounts | Account activity events | Beneficiaries | Loans |
|---|---|---:|---:|---:|---:|---:|
| RIP Money Bank P661 | `demo-rip-p661` (or `.env` value) | 500 | 650 | 5,000 | 300 | 100 |
| Nexus Bank P629 | `demo-bank-p629` | 200 | 240 | 1,200 | 100 | 35 |
| Meridian Bank P742 | `demo-bank-p742` | 200 | 240 | 1,200 | 100 | 35 |
| Horizon Bank P815 | `demo-bank-p815` | 200 | 240 | 1,200 | 100 | 35 |

All customer, account, ledger, loan, beneficiary and audit records are synthetic. Customer emails use `example.test`. All synthetic customer accounts use the same local-only password: `DemoBank#2026!` (unless overridden by `SYNTHETIC_CUSTOMER_PASSWORD`). This password is for emulator testing only and must never be used in a hosted environment.

The private emulator configuration uses `singleProjectMode: false` so the Admin SDK can address the distinct private project IDs through the same local emulator host. The generator writes bank-private data to separate Firestore emulator project IDs. It writes only bank identity and IFSC routing metadata to the shared emulator. Simulated external banks remain `INACTIVE` with `apiBaseUrl: null`; no X42 URL, credentials, activation, or live transfer outcome is fabricated. P661 also remains inactive until explicitly activated by the network operator.

## Financial consistency

- Amounts are integer paise (`Minor` fields).
- Account `postedBalanceMinor` is reconciled against the sum of its ledger credits minus debits.
- `heldMinor` is zero for seeded accounts; available balance is still derived by backend code.
- Historical account activity and loan disbursement/repayment records are explicitly marked `synthetic: true`.
- Synthetic KYC records contain metadata only. No identity documents are fabricated. Approval remains disabled in the admin UI when a request has no uploaded document paths.
- The seed is deterministic and repeatable for the same profile and project IDs. It overwrites the deterministic synthetic IDs only; it does not clear unrelated collections.

## Apply and run

See `PATCH-INSTALL.md` and `Apply-RIPPlatformPatch.ps1`. The script is designed for Windows PowerShell 5.1 and expects Node.js 24.12.0+ per the existing backend package requirements.

1. Start private and shared Firestore/Auth/Storage emulators in separate terminals.
2. Run `npm.cmd run seed:platform` from the bank project root.
3. Run `npm.cmd run verify:seed` and require `status: passed` and `ledgerReconciled: true` for every bank.
4. Run `npm.cmd run verify`.
5. Start the API with `npm.cmd start`.
6. In another terminal, run `cd frontend; npm.cmd install; npm.cmd run build; npm.cmd run dev`.
7. Open `http://127.0.0.1:5173`.

A synthetic customer can sign in with any seeded `example.test` email (for example `p661.customer0001@example.test`) and the local-only password above. Admin access is not provisioned by this patch; it must be explicitly provisioned through the existing admin provisioning process.

## X42 boundary

This patch prepares independent private datasets and external-bank beneficiary examples. It does not activate simulated banks or claim the existing local directory is a live X42 connection. Real interbank submission remains unavailable until the actual switch endpoint, signed request contract, bank secrets, bank API URLs and activation are supplied and verified. Do not treat seeded `SIMULATED`/synthetic history as real settlement.
