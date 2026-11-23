# Adversarial scenario matrix

Run these against the Firebase Emulator Suite before cloud configuration.

| Scenario | Expected invariant |
|---|---|
| duplicate customer email | registration rejected; no duplicate profile |
| customer reads another customer's account | denied |
| customer changes role/customerId | denied |
| customer creates a ledger entry from client | denied |
| account PENDING/HOLD/REJECTED/CLOSED sends | rejected |
| beneficiary not APPROVED | rejected without credit |
| insufficient balance | no balance or ledger change |
| above per-transfer limit | no balance or ledger change |
| two simultaneous debits | cannot produce negative balance |
| same request replay | no second debit/credit |
| invalid amount / >2 decimals | rejected before database write |
| duplicate incoming shared note | one credit only |
| receiver crash after credit before reply | restart sees credit and replies CREDITED |
| sender crash before settle | restart completes or refunds once |
| note write timeout + note exists | keep debit pending; do not refund |
| note write timeout + note read unavailable | mark reconciliation; do not refund blindly |
| confirmed note absent | refund once |
| incoming note malformed | REJECTED with reason; listener continues |
| receiver offline | note persists PENDING until restart |
| account closes with nonzero balance | rejected |
| duplicate loan approval | no second disbursement |
| loan repayment replay | no second debit |
| repayment over principal | rejected |
| ledger/balance mismatch | reconciliation records mismatch |
| one malformed note among many | other notes still processed |

A test is not considered passed until it asserts both the returned result and the resulting Firestore documents/balances/ledger postings.
