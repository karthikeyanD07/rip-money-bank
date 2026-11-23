# Changelog

## 2.0.0 — fresh PDF-aligned baseline

- Rebuilt the backend project around `Bank_Management_DB_Design.pdf`.
- Removed the legacy shared transfer-notice architecture and B01–B50 prefix routing.
- Added shared `banks` / `ifsc_registry` directory and private per-bank collections.
- Added X42 posted/held/available balance operations, integer-paise invariants, transfer limits and daily usage.
- Added same-bank atomic transfer and interbank HTTPS/HMAC receiver flow with private inbox idempotency and status recovery.
- Added opaque sessions, CSRF, Argon2id adapter, KYC workflow, private Storage upload, admin signed document URLs, notification outbox, beneficiaries, loans and portfolio.
- Added API route inventory, schema mapping, operational notes and three verification checklists.

## 2.1.0 — RIP Money Bank X42 multi-bank participant

- Rebased the downloadable package on the original bank backend ZIP; configured participant identity as RIP Money Bank / P661 / KART0M4N7CQ.
- Added the X42 central switch and worker as a separate reference/test-harness project.
- Replaced direct bank-to-bank outbound requests with signed bank-to-X42 submission and X42-to-destination routing.
- Added X42-mediated destination validation that returns only a masked account name.
- Added sender reconciliation against X42 transaction status; UNKNOWN outcomes retain the source hold.
- Added internal loan disbursement and idempotent repayment with account and ledger updates. Loans remain bank-local.
- Added PowerShell preflight, configuration, installation, verification, API start and pending-transfer reconciliation scripts.
- Added root and switch tests for the updated routing contract, IFSC directory compatibility, masked-name validation, loan repayment and idempotency.
