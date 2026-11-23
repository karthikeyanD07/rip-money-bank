# PDF schema mapping

| PDF collection | Code collection | Purpose / implementation |
|---|---|---|
| `users/{uid}` | `users` | UID, bankId, name, email, Argon2id password hash, role, status |
| `sessions/{sessionHash}` | `sessions` | Hashed opaque session token, CSRF hash, expiry, revocation |
| `kyc_requests/{requestId}` | `kyc_requests` | KYC paths, ₹1,000 demo opening credit, decision and reviewer |
| `accounts/{accountId}` | `accounts` | `customerUid`, accountNumber, INR, status, postedBalanceMinor, heldMinor |
| `beneficiaries/{beneficiaryId}` | `beneficiaries` | Owner, beneficiaryBankId, IFSC and account number |
| `transfers/{transferId}` | `transfers` | Internal/interbank lifecycle, integer amountMinor, idempotency key |
| `ledger_entries/{entryId}` | `ledger_entries` | Append-only debit/credit entries in paise |
| `transfer_limits/{accountId}` | `transfer_limits` | Per-transfer and daily limits |
| `daily_usage/{accountId_date}` | `daily_usage` | Daily usage keyed by Asia/Kolkata date |
| `idempotency_keys/{scopeKey}` | `idempotency_keys` | Request fingerprint, transferId and uid |
| `interbank_inbox/{sourceTransferId}` | `interbank_inbox` | Exactly-once receiver credit marker |
| `loans/{loanId}` | `loans` | Customer loan application and decision |
| `portfolios/{uid}` | `portfolios` | Collection exists in schema; current portfolio endpoint derives live accounts/loans |
| `notification_outbox/{eventId}` | `notification_outbox` | Durable post-commit notification event |
| `audit_logs/{logid}` | `audit_logs` | Admin decision and limit audit records |

Shared directory collections: `banks/{bankId}` and `ifsc_registry/{IFSC}`. Shared directory must not contain customer, balance, password, KYC or transfer records.
