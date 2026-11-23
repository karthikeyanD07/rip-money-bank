# Defensive review / adversarial checklist

The critical review asks: can a customer impersonate an admin, access another account, spend twice, exploit retries, or cause an unrecoverable interbank transfer?

Implemented controls:
- Firebase Auth user identity; admin role via custom claims from trusted provisioning script.
- Customer ownership and account status checked inside trusted business logic.
- Firestore client rules deny all financial writes.
- No service-account secrets in repository; `.env` and `secrets/` ignored.
- Integer paise; positive/precision validation.
- Firestore transactions for balance changes.
- Unique deterministic transaction document IDs for transfer/type idempotency.
- Refund only while original debit is PENDING.
- Receiver credit lookup before applying credit.
- Incoming shared note validation and approved-beneficiary check.
- Sender/receiver only touch their own shared notes by routing fields.
- Ambiguous shared-note write/read failures are held for reconciliation rather than blindly refunded.
- Account closure requires zero balance.
- Loan decision can occur only once; disbursement and ledger posting are atomic.
- Per-note watcher errors do not stop other notes.

Still required before any real Firebase deployment:
1. Add Emulator Suite integration tests for auth/rules and all Firestore transaction paths.
2. Harden shared-project Firestore rules with team-approved bank identity/ownership controls. Current shared rules are not supplied because this project must not overwrite the batch owner's rules.
3. Add request-level idempotency for every public operation at the API boundary.
4. Add transaction reversal/adjustment workflows and balanced double-entry accounting with clearing accounts.
5. Add rate limiting / abuse controls at an API gateway or hosting layer (not available in this Firebase-only local base).
6. Verify Firebase quota and billing status before using cloud resources.
7. Add operational alerting and a dead-letter/retry dashboard.
8. Security review the final shared Firebase rules and team service-account permissions.
9. No real money, sensitive identity documents, or production credentials in this learning system.

This review is intentionally adversarial; passing unit tests does not establish production security.
