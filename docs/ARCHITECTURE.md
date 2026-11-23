# Architecture — multi-bank X42 network

```text
RIP Money Bank customer
  | bank_session + CSRF
  v
RIP Money Bank API (P661)
  |-- RIP private Firebase (users, KYC, accounts, balances, loans, ledger)
  |-- signed HTTPS request (bank-specific secret)
  v
Central X42 switch + shared network directory
  |-- bank directory / IFSC registry
  |-- transfer routing / status / idempotency / delivery attempts
  |-- does not store customer credentials, KYC, balances or private ledgers
  |
  +---- signed HTTPS credit/status ----> Destination bank API
                                          |
                                          +-- destination private Firebase
```

Many independently operated banks connect to the same X42 switch. The switch is the hub; participants do not directly call peer banks. Shared infrastructure is not a shared customer/account database. Every bank owns its customer, KYC, account, balance, ledger, beneficiary, loan and internal-transfer records.

Same-bank transfers are atomic operations inside the originating bank. Loans are internal to the bank only. Interbank transfers use a saga: reserve funds locally, submit to X42, let X42 route to the receiving bank, then finalize the sender debit only after X42 reports SUCCESS. Release the hold only after definitive FAILED. UNKNOWN/timeout stays pending and must be reconciled.
