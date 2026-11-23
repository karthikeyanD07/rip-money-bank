# API route inventory

All routes are mounted under `/api/v1`. Browser routes use `bank_session`; state-changing browser requests require `X-CSRF-Token`. Transfer POSTs require `Idempotency-Key`. Peer-only routes require HMAC headers and do not use customer sessions.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create customer UID, Argon2id hash and pending KYC request (document upload follows) |
| POST | `/auth/login` | Public | Verify password and create opaque session |
| GET | `/auth/me` | Customer/admin | Resolve current UID and role |
| POST | `/auth/logout` | Customer/admin + CSRF | Revoke session |
| POST | `/kyc/documents` | Customer + CSRF | Upload PDF/JPEG/PNG to private Storage path |
| GET | `/admin/kyc-requests` | Admin | Pending/HOLD KYC queue |
| PATCH | `/admin/kyc-requests/{id}` | Admin + CSRF | APPROVE/HOLD/REJECT |
| GET | `/admin/kyc-requests/{id}/documents?path=...` | Admin | Five-minute signed URL for an attached private KYC object |
| PATCH | `/admin/limits/{accountId}` | Admin + CSRF | Set per-transfer and daily limits |
| GET | `/accounts` | Customer/admin | List caller-owned accounts |
| GET | `/accounts/{accountId}/balance` | Owner | Balance read |
| GET | `/x42/balance/{accountId}` | Owner | X42 posted/held/available balance |
| POST | `/x42/validate` | Owner | Validate account and available balance |
| GET | `/x42/transactions/{referenceId}` | Owner | Transfer operation status |
| POST | `/x42/debit` | Internal X42 token only | Commit an already-reserved debit; never browser-accessible |
| POST | `/x42/credit` | Internal X42 token only | Trusted internal credit operation; never browser-accessible |
| POST | `/beneficiaries` | Customer + CSRF | Add beneficiary |
| GET | `/beneficiaries` | Customer | List own beneficiaries |
| DELETE | /beneficiaries/{beneficiaryId} | Customer + CSRF | Delete an owned beneficiary |
| POST | `/transfers/internal` | Customer + CSRF | Same-bank atomic transfer |
| POST | `/transfers/interbank/validate` | Customer + CSRF | Validate destination through X42; returns masked account name only |
| POST | `/transfers/interbank` | Customer + CSRF | Reserve and submit to central X42 switch |
| GET | `/transfers/{transferId}` | Owner | Transfer status |
| GET | `/directory/ifsc/{ifsc}` | Public | Resolve central IFSC directory |
| POST | `/interbank/validate` | X42 HMAC only | Destination account validation; returns masked name only |
| POST | `/interbank/credits` | X42 HMAC only | Receiver credit endpoint |
| GET | `/interbank/transfers/{id}` | X42 HMAC only | Receiver status inquiry |
| POST | `/loans` | Customer + CSRF | Apply for an internal bank loan |
| POST | `/loans/{loanId}/repay` | Customer + CSRF + Idempotency-Key | Repay an approved loan from an owned account |
| PATCH | `/admin/loans/{id}` | Admin + CSRF | Approve/reject loan application |
| GET | `/portfolio` | Customer | Owned account and loan summary |

The PDF's X42 debit/credit operations are service-layer operations, not browser endpoints. Receiver credit is available only through the authenticated interbank peer route.

## Platform frontend read APIs (v2.2 overlay)

All routes below require a valid `bank_session` cookie. Mutating routes continue to require `X-CSRF-Token`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/transactions` | Customer | Caller-owned transfer/activity history |
| GET | `/api/v1/kyc/status` | Customer | Caller-owned KYC request status; document paths are not exposed |
| GET | `/api/v1/admin/dashboard` | ADMIN / SUPER_ADMIN | Bank-private operational aggregates |
| GET | `/api/v1/admin/bank-settings` | ADMIN / SUPER_ADMIN | Bank identity and network readiness (no secret or endpoint URL) |
| GET | `/api/v1/admin/customers` | ADMIN / SUPER_ADMIN | Customer directory (password hashes are excluded) |
| GET | `/api/v1/admin/accounts` | ADMIN / SUPER_ADMIN | Bank account list |
| GET | `/api/v1/admin/transactions` | ADMIN / SUPER_ADMIN | Bank transfer/activity list |
| GET | `/api/v1/admin/loans` | ADMIN / SUPER_ADMIN | Bank loan list |
| GET | `/api/v1/admin/audit-logs` | ADMIN / SUPER_ADMIN | Administrative audit history |

The React frontend uses the Vite `/api` proxy in development and never connects directly to Firestore. Production deployment must expose the frontend and bank API through a same-origin reverse proxy or explicitly configured secure origin with credentialed CORS and CSRF protections.
