# Platform functional acceptance

- [ ] Customer login uses the backend-issued HttpOnly session cookie and CSRF token.
- [ ] Registration creates a customer and pending KYC request through the backend.
- [ ] Customer dashboard, accounts, activity, beneficiaries, loans and KYC read backend data.
- [ ] Internal transfers submit an idempotency key and use the backend transfer service.
- [ ] Loan applications and repayments use the bank loan service.
- [ ] KYC uploads use the private Storage service and backend path ownership checks.
- [ ] Admin dashboard, bank profile, customer/account/transaction/loan/audit views require ADMIN or SUPER_ADMIN.
- [ ] KYC approval remains blocked until document paths exist.
- [ ] Four bank datasets use separate private Firestore emulator project IDs.
- [ ] Shared directory contains bank identity and IFSC routing metadata only.
- [ ] Seed verification proves account ledger credits minus debits equal posted balances.
- [ ] P661 and all synthetic external banks remain INACTIVE with null API URLs.
- [ ] X42 transfer tests are not represented as live until actual endpoint credentials and contract are verified.
