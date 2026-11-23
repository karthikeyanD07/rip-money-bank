# Acceptance criteria mapped to the supplied team guide

| Guide requirement | Implementation status |
|---|---|
| Local bank database + shared Firestore notice board | Architecture configured |
| B01-B50 and B00/B99 | Registry seeder |
| IFSC first-three-character routing | Implemented |
| Frozen transfer note fields/statuses | Contract validator |
| Registration, opening balance INR 1000, PENDING account | Auth registration service |
| Admin pre-provisioned by backend | Admin provisioning script |
| Account approve/hold/reject | Account service status operation |
| Customer own-account boundary | Service ownership checks + rules |
| Same-bank transfer | Atomic balance and ledger operation |
| Interbank Send | Debit then shared note |
| Receive | Validation, beneficiary approval, idempotent credit |
| Settle | Complete debit/refund then settled=true |
| Refund | Only pending debit; one refund record |
| Start listening | Snapshot watchers with per-note error isolation |
| Loans apply/approve/reject | Loan service |
| Loan disbursement and repayment | Atomic ledger/balance logic |
| Transaction history | Paginated account history service |
| Admin transfer limit | Account service |
| Email notifications | Deliberately omitted: requires an external email service, prohibited by Firebase-only constraint |
| Document upload | Metadata/status only; upload integration deferred pending explicit Firebase Storage/free-plan decision |
| Integration and crash tests | Must be run after project configuration; pure unit tests included |

## Important note
The team guide asks for Nodemailer emails and customer document uploads. These are not silently represented as complete. Nodemailer is external SMTP and therefore excluded. Actual file storage is deferred; the KYC record currently tracks review/document status only.
