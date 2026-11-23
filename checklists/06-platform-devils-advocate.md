# Devil's-advocate review and known boundaries

- [ ] Never run the synthetic seed against production Firebase.
- [ ] Never overwrite unrelated shared-directory identities or IFSC mappings; seed aborts on conflicts.
- [ ] All synthetic customer credentials are local-only and must not be reused outside emulators.
- [ ] No admin user is created by this patch; admin provisioning requires explicit authorization.
- [ ] No external bank is activated and no endpoint URL or bank secret is invented.
- [ ] Synthetic KYC records contain metadata only; no fake identity documents are created.
- [ ] Historical synthetic transactions are labelled and must not be interpreted as real settlement.
- [ ] Financial records use integer paise and are reconciled against the ledger.
- [ ] Each bank's private data is isolated by its own Firestore emulator project ID.
- [ ] Browser code never accesses Firestore directly and never stores the session cookie in JavaScript.
- [ ] Development Vite proxy is not a production reverse proxy; production requires same-origin secure routing or a deliberately configured credentialed CORS/CSRF design.
- [ ] X42 interbank processing remains blocked until the actual switch contract, bank API URLs, credentials, activation and live integration tests are available.
- [ ] Local in-memory unit tests do not prove emulator, cloud IAM, hosted X42 or production settlement behavior.
