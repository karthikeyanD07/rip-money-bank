# Implementation status — RIP Money Bank X42 participant

## Bank-local capabilities in this codebase

- Customer registration/login with Argon2id adapter, opaque sessions and CSRF protection.
- KYC document upload to private Storage, admin review, account opening and one-time synthetic demo opening credit.
- Account ownership, balance, available/held balance, beneficiaries and portfolio endpoints.
- Same-bank transfers with atomic debit/credit, ledger entries, limits, daily usage and idempotency.
- Internal-only loan application, admin decision, local disbursement and repayment service. No interbank loan feature is exposed.
- Audit records, notification outbox worker and private Firestore/Storage deny-all client rules.

## X42 multi-bank integration

- Bank API sends HMAC-signed requests to the central X42 switch; it does not call other banks directly.
- X42 resolves destination IFSC through the shared directory, stores routing/transaction state in its own store, and forwards signed credit/status calls to the receiving bank.
- Receiving bank authenticates X42, verifies the originating bank is ACTIVE in the shared directory, applies receiver idempotency and posts the credit to its own private ledger.
- Sender reserves funds before submission, finalizes debit only after X42 SUCCESS, releases only after definitive FAILED, and retains the hold for UNKNOWN.
- Shared directory supports bank records keyed by IFSC with `bankId` field as in the Postman guide, as well as bankId-keyed records.

## Configuration still required

- RIP private Firebase project ID, private service account and Storage bucket.
- Shared X42 Firebase project ID and read access for the bank service account.
- X42 public HTTPS base URL and the unique P661-to-X42 HMAC secret.
- X42 operator must register RIP Money Bank and configure its public bank API URL and the same per-bank secret.
- Destination banks must be registered, active, reachable over HTTPS and configured with the matching X42-to-bank secret.

## Verification boundary

The automated tests use an in-memory Firestore adapter and mocked HTTP responses. They verify local transaction invariants, bank-to-X42 request signing, X42 status reconciliation, receiver credit idempotency and central routing logic. They do not prove access to the real shared Firebase project, live X42 deployment, live bank endpoints, regulatory compliance or payment-rail settlement.
