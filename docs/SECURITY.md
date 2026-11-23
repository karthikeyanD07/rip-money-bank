# Security controls

- All Firestore and Storage client rules deny all access; trusted backend is the only data plane.
- Shared directory and private bank projects use separate project IDs and service-account credentials.
- Passwords use Argon2id through the required runtime adapter; no silent weaker fallback.
- Sessions are 256-bit random opaque tokens; only SHA-256 hashes are stored.
- CSRF tokens are random and stored as hashes; state-changing browser routes require the header.
- Bank-to-X42 and X42-to-bank requests authenticate the switch/bank identity, timestamp, nonce, method, path and body with HMAC-SHA256 and timing-safe signature comparison.
- X42 nonces are recorded in the shared `switch_nonces` collection; receiving-bank nonces are stored privately and rejected on replay. Configure Firestore TTL on `expiresAt`.
- Money is integer paise; X42 checks safe integers, account state, holds and limits.
- Ledger records are append-only by application design; never edit/delete historical entries.
- Secrets are environment/secret-manager values, never directory fields or source code.

This is not production-certified. Add rate limiting, MFA, security monitoring, key rotation, HSM-backed keys, data retention controls and independent security review before any real deployment.
