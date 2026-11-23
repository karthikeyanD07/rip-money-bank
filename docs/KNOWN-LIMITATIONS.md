# Known limitations

- This is a backend-only educational banking implementation; no customer/admin web frontend is included.
- Real Firebase credentials, shared project permissions, X42 public URL and bank API public URL must be supplied by their respective owners.
- X42 central switch and bank participant have to be deployed separately. The bank package cannot deploy or administer the operator's X42 infrastructure without operator authorization.
- X42 status reconciliation is an explicit worker/script (`npm run reconcile:pending`); configure a scheduler for hosted operations.
- SMTP delivery requires SMTP configuration and Nodemailer.
- KYC document upload requires the private Storage bucket and correct IAM. KYC approval workflow is not regulatory identity verification.
- Demo opening credit is synthetic assignment data only, not an external deposit.
- Loan workflows are bank-local and simplified; no bank-to-bank loan functions exist.
- Interbank reversal/compensation endpoints are not yet implemented; the X42 build plan lists reversal as a SHOULD and the final API contract is still required. Do not represent a successful transfer as reversed without a separately specified, audited compensation flow.
- No payment rails, RBI/AML/KYC compliance certification, HSM-backed key management, production fraud controls, double-entry interbank settlement ledger or production resilience guarantees.
- Unit tests use in-memory Firestore and mocked HTTP; live Firebase/X42/two-bank integration tests remain pending real access.
