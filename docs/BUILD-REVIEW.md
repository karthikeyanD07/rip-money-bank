# Independent adversarial review result

Review standard: assume the implementation is wrong until evidence says otherwise.

## Build checks
- JavaScript syntax: run `npm run check`.
- Pure domain tests: run `npm test`.
- Integration acceptance: must be completed against Firebase Emulator Suite after local configuration.

## High-risk design points examined
1. Ambiguous Firestore write timeout: do not refund unless a successful read confirms note absence.
2. Duplicate incoming note: deterministic CREDIT transaction ID plus transaction lookup.
3. Duplicate refund: original debit must still be PENDING and refund document must not exist.
4. Concurrent same-bank send: Firestore transaction re-reads balance and atomically applies both postings.
5. Unauthorized account access: ownership checked by customerId in trusted services; client financial writes denied.
6. Admin escalation: role is Firebase custom claim set by provisioning script, not customer-editable profile.
7. Listener restart: snapshot queries cover pending notes that remain in shared Firestore.
8. Invalid shared note: validate before processing; malformed note is rejected with reason.
9. Loan double approval: PENDING-only transition in transaction.
10. Account closure: zero balance required.

## Findings that remain open
- Shared notice board authorization rules are controlled by the batch Firebase owner and must be reviewed jointly.
- Shared note writes and private database commits cannot be one cross-project atomic transaction. Recovery is a reconciliation protocol, not true distributed ACID.
- B00/B99 dummy responder processes must be run by the batch registry keeper; this project seeds registry entries but cannot impersonate other banks' server-side note ownership.
- API boundary, request authentication middleware, throttling, and emulator integration tests remain to be added before calling the service deployable.
- The loan model is a simplified principal-only learning model, not an amortization/interest engine.

Conclusion: the ZIP is a substantially expanded service/database foundation, but not a finished, production-secure bank application. The remaining items are explicit, not hidden.
