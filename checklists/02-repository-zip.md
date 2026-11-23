# Repository and ZIP verification checklist

- [x] Fresh project root with version marker and documented Node requirement.
- [x] `.env.example` contains placeholders only.
- [x] Private and shared Firebase project IDs/configurations are separate.
- [x] Private Firestore rules deny all direct client access.
- [x] Shared Firestore rules deny all direct client access.
- [x] Shared schema example contains only bank directory records.
- [x] Private collection example maps the PDF schema.
- [x] Sample HTTP requests included.
- [x] Tests and in-memory Firestore adapter included.
- [x] No `.env`, service-account JSON, `node_modules`, `.git`, `.firebase` or logs in release ZIP.
- [ ] Run `npm ci` from a clean extraction on Windows.
- [ ] Install optional Argon2/Nodemailer peer packages and verify production adapters.
- [ ] Start private and shared emulators and execute two-bank integration suite.

## RIP Money Bank / X42 release additions
- [x] Fresh base is the original bank backend ZIP, not the previously generated RIP integration ZIP.
- [x] Bank identity configured as P661 / RIP Money Bank / KART0M4N7CQ.
- [x] Central X42 switch source, API and worker included separately from the bank participant.
- [x] PowerShell preflight, configuration, install/test, API start and reconciliation scripts included.
- [x] Release excludes `.env`, service-account JSON, `secrets/`, `node_modules/`, `.git`, logs and emulator state.
- [ ] Clean Windows extraction/install test on Node.js 24.12+ remains to be performed on the user's machine.
