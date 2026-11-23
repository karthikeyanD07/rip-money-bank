# Operations

## RIP Money Bank participant

- Keep the private Firebase project and credentials dedicated to RIP Money Bank.
- Give the bank service identity read-only access to the shared X42 directory and the minimum private-project permissions required by the Admin SDK.
- Configure `X42_BASE_URL`, `X42_BANK_SECRET` and `PEER_SHARED_SECRETS_JSON` from the X42 operator's secure handoff. The secret must be unique to P661 and must never be stored in Firestore or source control.
- Expose the bank API over HTTPS at a stable public URL. Register that exact base URL with the X42 operator.
- Keep the API and scheduled `reconcile:pending` task running. Reconciliation must never release funds for UNKNOWN outcomes.
- Monitor PENDING transfers and the X42 operator's REVIEW queue. Escalate ambiguous outcomes; do not manually mark them successful or failed without destination evidence.

## X42 operator

- Maintain the shared `banks`, `ifsc_registry` and `switch_nonces` collections.
- Maintain X42's private transaction store, idempotency records, routing jobs and delivery attempts.
- Provision a unique secret per bank. The same P661 secret is configured in X42 and RIP Money Bank; never use one global secret across all banks.
- Register banks as INACTIVE, verify `/health`, then activate. Deactivate compromised or unavailable participants.
- Run the X42 API and worker as separate long-running services with TLS termination, secret management, logs and alerting.
