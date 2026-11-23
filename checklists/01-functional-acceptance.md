# Functional acceptance checklist

## Shared bank directory
- [x] `banks/{bankId}` uses the PDF fields and status values.
- [x] `ifsc_registry/{normalizedIfsc}` maps one unique IFSC to one bankId.
- [x] IFSC is normalized to uppercase and validated as 11 characters.
- [x] Inactive banks and missing HTTPS API URLs cannot be used for transfer routing.
- [ ] Seed and verify the actual assigned bank metadata and peer URLs.
- [ ] Run two real Firebase project emulator instances and verify directory isolation.

## Identity and KYC
- [x] Registration creates a server UID, user record and pending KYC request.
- [x] Password service uses Argon2id and fails closed if the Argon2 library is absent.
- [x] Session cookie is opaque; only token hashes are stored.
- [x] CSRF hash is checked on state-changing browser requests.
- [x] Logout revokes the session.
- [x] Admin KYC APPROVE/HOLD/REJECT route is role-gated.
- [x] APPROVE creates the ₹1,000 demo credit and opening ledger entry atomically.
- [x] Trusted backend upload to private Firebase Storage; admin receives time-limited signed read URLs.
- [ ] Verify password login and cookie flow against Firebase Emulator with Argon2 installed.

## X42 and internal transfers
- [x] Amounts are positive safe integer paise.
- [x] Available = posted − held; invalid balance invariants fail closed.
- [x] Reservation holds funds without changing posted balance.
- [x] Debit posts once and writes ledger atomically.
- [x] Release removes a pending hold and is idempotent.
- [x] Receiver credit and inbox marker commit atomically.
- [x] Same-bank transfer atomically debits, credits, writes ledger and idempotency record.
- [x] Daily and per-transfer limit checks are implemented.
- [ ] Add concurrency tests against real Firestore transactions (not just in-memory adapter).
- [ ] Add paginated ledger history and a scheduled reconciliation runner.

## Interbank
- [x] Sender resolves destination by full IFSC through the shared directory.
- [x] Sender reserves before submitting a signed request to the central X42 switch.
- [x] X42 resolves the destination and routes to its registered bank API; banks do not call one another directly.
- [x] X42-to-bank request signs caller identity, timestamp, nonce, method, path and body.
- [x] Receiver authenticates X42 and rejects stale/replayed nonce.
- [x] Receiver credits at most once using `interbank_inbox`.
- [x] Sender does not release funds on timeout/unknown result.
- [x] Status inquiry and pending reconciliation primitives exist.
- [ ] Add end-to-end tests with two independent Firebase project instances and two API servers. (Requires Firebase Emulator setup.)
- [ ] Add secure per-bank X42 secret provisioning/rotation and operator-driven recovery runbook.

## Customer/admin features
- [x] Beneficiary create/list/delete.
- [x] Account list and balance endpoints.
- [x] Loan application and admin decision.
- [x] Portfolio endpoint derives owned accounts and loans.
- [x] Admin per-transfer/daily limits endpoint.
- [x] Approved internal loans disburse to the originating bank account with a ledger credit.
- [x] Internal loan repayment debits an owned account, tracks outstanding principal and is idempotent.
- [ ] Interest accrual, amortization schedules, fees and regulatory loan servicing are outside this prototype.
- [x] Durable notification outbox and separate SMTP worker with claim lease and at-least-once delivery semantics.
- [ ] Verify SMTP delivery and retry behavior against a configured test SMTP server.
