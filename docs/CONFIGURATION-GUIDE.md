# Configure this ZIP after extraction

1. Install Node.js 20 or later.
2. Extract the ZIP into a folder and open a terminal there.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Install Firebase CLI if needed: `npm install -g firebase-tools`.
6. Run `firebase login`.
7. Create or select your private Firebase project. Enable Authentication > Email/Password and create Firestore in the region your team requires.
8. Obtain a service-account JSON for the private project and place it at `secrets/private-service-account.json`.
9. Ask the team Firebase owner for the shared project ID and a narrowly scoped service credential for the shared notice board. Save it as `secrets/shared-service-account.json`. Do not use a personal owner credential.
10. Set `PRIVATE_FIREBASE_PROJECT_ID`, `SHARED_FIREBASE_PROJECT_ID`, `BANK_CODE`, `BANK_NAME`, and credential paths in `.env`. Do not change the shared note contract.
11. For local testing, start emulators with `npm run emulators`; leave `USE_EMULATORS=true`. Seed the local bank registry using `npm run seed`.
12. Set a strong `ADMIN_PASSWORD` (at least 14 characters), then run `npm run provision-admin`.
13. Run `npm run verify`.
14. Only after emulator tests pass, configure a separate cloud `.env` with `USE_EMULATORS=false`. Deploy private Firestore rules/indexes only to your own private project. Do not deploy this project's rules to the shared batch project.
15. Run `npm run seed` and `npm run provision-admin` against the private project after verifying the target project IDs.

## Free-tier discipline
Use emulators for routine tests. Check current Firebase pricing/quotas in the console before cloud testing. Do not enable billing. If a feature asks for Blaze, stop and do not enable it. This repository does not use Cloud Functions, paid hosting, external SQL, or third-party services.

16. Start the interbank worker with `npm run listen`. Keep that terminal running during interbank tests; it starts Receive and Settle watchers and resumes pending notes after restart.
