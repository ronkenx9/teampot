# Teampot — Moderato Verification

Tempo Moderato chain 42431. Evidence below is from local server `PORT=8790` unless noted.

## Original P0 Proofs
| Primitive | Result | Evidence |
|---|---|---|
| Batch payroll, one transaction, per-transfer memo | WORKS | `scripts/probe.ts`, tx `0x720cd5dc6d6eec1959bb7143022457919dfb1eb8c281605c4c7a87dac2df1a1a` |
| Access key periodic limit | WORKS; fees count against limit | `scripts/probe.ts` |
| Access key sub-delegation | NOT ALLOWED | `scripts/probe.ts`; company root must issue every key |
| Recipient allowlist on access keys | WORKS | `scripts/probe3.ts` |
| Fee sponsorship with P256 account | WORKS | `scripts/probe2.ts` |
| Passkey public key as spending key | WORKS | `scripts/probe5.ts`, `scripts/e2e-passkey.ts` |
| Receipt verification | WORKS | `scripts/e2e-passkey.ts`; replay and forged receipts refused |
| Virtual addresses | Still needs proof-of-work salt | `scripts/mine-salt.ts` |
| Tempo Earn | No public testnet vault found | Shown as simulated only |
| Zones | Early testnet | Not used for claims |

## Build-Out Proofs
| Feature | Result | Evidence |
|---|---|---|
| Pot spend | WORKS | Sam paid Figma, tx `0xe7271ebe43ea0b2290a4ee9f183c7b4c5bb7e08cb6542cb81dbab0036a2900b4` |
| Perk spend | WORKS; separate Lunch key | Sam used Lunch at Uber Eats, tx `0x1786a2bb8d0e959e9f326b7882c15f24290eff13a4aa75ec4fddbb5d945637eb` |
| Approve and add to list | WORKS with demo key rotation | Held PixelVault payment approved, tx `0x0b972e09253124b10f7c12d0092e61e3fc1160f07764b17f7a77c7c4a05a52fa`; Design card re-issued, tx `0x0945c4c724ca1b586318f975e08bd6f8b8b419dd383de5cb47d42d4ce554a3ef`; next PixelVault spend succeeded, tx `0x2af8deff8bc63100bf6d60ab0db2084b14b89734e417ea3878136f39f699cbcb` |
| Re-authorizing same revoked demo key | DOES NOT WORK | Tempo returns `KeyAlreadyRevoked`; Teampot now rotates demo key versions when re-issuing |
| Passkey re-issue after list change | Not fully proven | Code attempts revoke + authorize; if Tempo refuses reuse, UI asks the person to turn Face ID on again |
| Over-limit held path | WORKS | Sam over-limit Figma payment held and returned in `npm run e2e` |
| Payday preview/confirm/history | WORKS | Payday run for 4 staff, tx `0x6ce6c27298a7ba5e91d02e6a8d691d93380e82e522fb59c0e9314644cfc0802e`, 1.489s |
| Payday idempotency | WORKS | `npm run e2e` repeats the same `requestId` and receives the same tx |
| Contractor decline | WORKS app-side | `INV-1041` declined with reason in `npm run e2e` |
| Contractor approve and pay | WORKS | Mateo paid `INV-1042`, tx `0x65a0acc9324c1310837270a595ebfa38ab68a0f32202d8fccb71125ed3f6c96c` |
| Quarter close | WORKS | Design savings `1065`, 20% kudos pool `213`, tx `0x8b9bcec964b801a0874a418904abcf4314db972147926a20b94103f434d28f71` |
| Teammate kudos award | WORKS | Sam sent Ava $1 kudos, tx `0x586cbdc32c800d5f4649d0f777c20055bdb831b6f28eec2bd59a8fd5b2ede389` |
| Face ID spend and forged receipt refusal | WORKS | Ava enrolled, tx `0x0fe1d8ca3a9b9b5b8f0bb38d4e4a88134188997802c441b713257f714ce3e632`; Ava paid Adobe Fonts, tx `0x66d1a8836f5bad68354b4bb7925c18222dfa6b70e2d6d57a5e8f2499e921210a`; forged receipt returned error |

## Design Consequences
- Team pot = one access key per person, issued by the company account, with periodic cap and vendor allowlist.
- Perk = one separate access key per perk, with its own period, cap, and vendor list.
- Held for approval = Tempo rejects the spend, Teampot records it, then the company account pays directly if a lead approves.
- Re-issued demo cards rotate to a new derived key version because revoked keys cannot be reused.
- Earned while unspent remains simulated until a public testnet vault is available.
