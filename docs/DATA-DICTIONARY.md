# Data dictionary

The canonical collection names and sample fields are in `bank_db/collections.example.json` and `docs/SCHEMA-MAPPING.md`. Amount fields ending in `Minor` are integer paise. Account balances are `postedBalanceMinor` and `heldMinor`; available balance is derived and must never be persisted as an independently writable field. `accountId` is the Firestore document ID; `accountNumber` is the customer-facing identifier.

Shared directory fields are defined by `shared_db/bank_directory_seed.example.json`. Only `banks` and `ifsc_registry` are permitted in the central project.
