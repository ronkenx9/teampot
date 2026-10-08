# Teampot — Tempo primitives verified on Moderato (chain 42431), 2026-10-08

| Primitive | Result | Evidence |
|---|---|---|
| Batch payroll (one atomic tx, many recipients, per-transfer memo) | WORKS — 5 recipients, 1.2 s | tx 0x720cd5dc6d6eec1959bb7143022457919dfb1eb8c281605c4c7a87dac2df1a1a (`scripts/probe.ts`) |
| Access key with periodic limit ($100/hour) | WORKS — $60 ok, next $50 reverted on-chain; remaining 39.999822 (fees count against the limit) | `scripts/probe.ts` |
| Access key sub-delegation (key authorizes another key) | NOT ALLOWED — root/company account must issue every key | `scripts/probe.ts` |
| Access key recipient allowlist (scopes.recipients on transfer / transferWithMemo) | WORKS — approved vendor paid, unapproved vendor reverted | `scripts/probe3.ts` |
| Fee sponsorship (feePayer = company) with P256 account | WORKS — employee $20 → $15 exactly for a $5 payment | `scripts/probe2.ts` |
| Passkey (webAuthn) spending key authorized from public key only | WORKS — authorized by public key, WebAuthn-signed spend succeeded, off-list vendor rejected | `scripts/probe5.ts`, `scripts/e2e-passkey.ts` (headless WebAuthn); real Face ID needs a person at the device |
| Device-reported payments | Server re-checks the receipt: success, from the company account, exact recipient and amount; replays refused | `scripts/e2e-passkey.ts` |
| Virtual addresses (TIP-1022) | Needs proof-of-work salt for master registration (~2^32 hashes, ~3 min at 27M/s, 8 workers) | `scripts/mine-salt.ts` |
| Tempo Earn | No public testnet vault; requires deploying an experimental ERC-4626 Earn stack | viem.sh/tempo/guides/earn |
| Zones | Testnet-only, early, breaking changes expected | viem.sh/tempo/guides/earn/zones |

## Design consequences
- Team pot = one access key per person, issued by the company account, with a periodic cap **and** a vendor allowlist. Both chain-enforced.
- "Held for approval" = chain rejects an off-list vendor → app records the request → lead approves → company account pays directly (with memo).
- Team-pot spends run as the company account, so the company pays every network fee; employees never see one.
- "Earned while unspent" and "Private payroll" are labelled simulated / roadmap unless an Earn stack or Zone is stood up later.
