# Technical demo video (≤ 3:00): how it's built

Colosseum: technical and direct; show implementation, the integration and the architecture decisions.

1. **Architecture (0:00–0:30).** Company account → department accounts (funded P256 roots) → member access keys (periodic cap + recipient allowlist) → passkey keys. Hono API on Vercel; React PWA; state in versioned Blob files with no secrets.
2. **Department delegation (0:30–1:00).** Run `scripts/probe-dept.ts` or show it in the app: Finance funds Design (tx), the Design root issues Sam's key (tx), Sam pays Figma (tx), an off-list payment reverts. Open each receipt on the explorer.
3. **Held decision (1:00–1:30).** Sam pays an unapproved vendor → the chain reverts → held → Ava approves from the Design account. Show that Ava can't approve her own request (403).
4. **Payday (1:30–1:50).** One batch transaction pays everyone, with a memo per line; open the receipt.
5. **Passkeys (1:50–2:30).** An invite link → Face ID creates a WebAuthn P256 key → the department authorizes its public key → the device signs the spend → the server re-verifies the receipt (recipient + amount) and refuses forged or replayed receipts. Sign-in checks origin and rpIdHash.
6. **Honest limits (2:30–3:00).** App-enforced vs chain-enforced (from VERIFIED.md), and what lands with Tempo T6 and mainnet.
