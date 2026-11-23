# Platform patch and repository acceptance

- [ ] Patch manifest includes SHA-256 for every payload file.
- [ ] Installer validates base version 2.1.0 and Node.js 24.12.0+.
- [ ] Installer backs up every overwritten file before copying.
- [ ] Patch contains no `.env`, service-account files, secrets, `.git`, `node_modules` or emulator data.
- [ ] Patch performs overlay-only copies and never deletes project files.
- [ ] Backend verification runs immediately after application and stops on failure.
- [ ] Frontend dependency install, tests and production build have separate checkpoints.
- [ ] Seed command is guarded to emulator mode and has a separate reconciliation verifier.
- [ ] PowerShell scripts are compatible with Windows PowerShell 5.1.
- [ ] ZIP contents are inspected after packaging and compared with the manifest.
