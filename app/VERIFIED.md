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

## V3 Department Delegation Proofs
| Feature | Result | Evidence |
|---|---|---|
| Department account primitive | WORKS | `scripts/probe-dept.ts`: Finance funded a P256 department root, tx `0x9bef106c1e6204d87d65b671db841bb7e3c867cdec0abf12a0b30207c6fd0a99`; department root authorized member key, tx `0x1ac2168da980a8d858c095cdaf1b70764c563527e2ca5899237f3f03cddc4edc`; member spent to approved vendor, tx `0x057fedb658cfea82809f82339e767a0d4d4546ca38fb50af19ac2469f12389c0`; off-list spend rejected; department returned funds, tx `0x342c544a6e601304449c2f778a36a4551513da97b3194fb51acc6447910beaf1` |
| Finance funds Design in app setup | WORKS | `npm run e2e` asserts Design has a positive funded balance after `/api/setup`; Design funding tx `0x254e8207816773c4a11a7e30af87756f9e02fffaa78ccc3f3e60d395e6c6906a` |
| Sam spends through a Design-issued key | WORKS | `npm run e2e`, Sam paid Figma from Design, tx `0x73ac369cb1955fed2aba0b9d008810d873a300eb8a1bcec5b46b07ba6747e76a`; Design balance decreased |
| Off-list hold and department approval | WORKS | PixelVault spend held, Ava approved from Design, tx `0x06a4189d166461c8d383d6263076420839ae98657e562d2265ee7f10a27e2c7f`; e2e asserts Design balance decreased after approval |
| Lead self-approval block | WORKS | `npm run e2e` returns 403 for Ava approving Ava's own held request; Finance can return it |
| Department returns unspent budget | WORKS | Design returned $10 to Finance, tx `0xedfaafc4d0504e6a67b226e814f14278e8d7342239233f6bb9bd72a48320feb3`; Design balance decreased |
| Department-scoped passkey spend | WORKS | `npm run e2e:passkey`; Ava enrolled against Design, paid Adobe Fonts from Design, tx `0x2a15a3db7d382029304450b5b4fb4473ff2950ceeff50545a821dbd6f040dd53`; forged receipt refused |

## Design Consequences
- Department = one funded P256 account. Finance funds it with a real transfer; the department root issues member and perk access keys.
- For the seeded demo, each department root is a server-held P256 key derived from `OPERATOR_PK` and the state epoch. State stores no key material.
- Head takeover with Face ID is not real on Moderato t5 in this build. The honest closest version is Face ID as a department-issued spending key; true root/admin-key takeover needs a supported root/admin-key rotation path.
- Finance's frame is chain-enforced by the department account balance and access-key limits/scopes. "Single payments over $X need Finance" remains app-enforced if enabled later.
- Perk = one separate access key per perk, issued by the person's department account, with its own period, cap, and vendor list.
- Held for approval = Tempo rejects the spend, Teampot records it, then the department account pays directly if an eligible lead or Finance approves.
- Re-issued demo cards rotate to a new derived key version because revoked keys cannot be reused.
- Earned while unspent remains simulated until a public testnet vault is available.

## Pass 4 Product-Ready Proofs
| Feature | Result | Evidence |
|---|---|---|
| Real passkey sign-in | WORKS app-side with WebAuthn verification | `scripts/e2e-passkey.ts`: Ava enrolls a headless WebAuthn passkey, signs a server challenge, receives an HTTP-only session cookie, and `/api/state` reports `{ personId: "ava", demo: false }` |
| Session authorization | WORKS | `scripts/e2e-passkey.ts` refuses Ava's Engineering return; `server/app.test.ts` proves Sam cannot spend as Ava |
| Invite onboarding | WORKS | `scripts/e2e-passkey.ts`: Finance creates Nina Park's one-time invite; Nina accepts with a passkey and spends from Design, tx `0x52b2a6f45ef58521bc3af88fe6c3aac2e7e5de4b0979a076ce3b1b9e416fc015` |
| Company Finance rule | WORKS app-side | `scripts/e2e.mjs`: Sam's $1,200 Figma payment becomes a held `finance-rule` decision; Ava is refused; Finance returns it |
| Contractor department pay | WORKS | `scripts/e2e.mjs`: Mateo belongs to Design and invoice pay now uses the department account, tx `0x857fb49f398232bfc60abe862788391038bc92dc18a8a60990e78481fb6cdf5a` |
| Optimistic concurrency guard | WORKS | `server/store.test.ts`: stale version save rejects with 409 and preserves the newer state |
| Rate limiting | WORKS app-side | Sign-in, invite, invite acceptance, setup, demo-session and reset routes use in-memory per-IP buckets and return 429 on excess attempts |
| Health check | WORKS | `curl http://localhost:8790/api/health` returned `{ "ok": true, "service": "teampot", "version": 189 }` during local gate run |

## Pass 4 Real vs App-Enforced
- Real on Moderato: department funding, department-issued demo/passkey spends, invitee passkey spending, contractor pay from the department account, passkey receipt verification, payday, approvals, returns, quarter close and kudos.
- App-enforced: session role authorization, one-time invite expiry/use, the "payments over $X need Finance" threshold, setup/rate-limit boundaries, and optimistic state conflict detection before saving.
- Not chain-enforced: Tempo Moderato exposes periodic limits and recipient scopes, but this build did not find a supported per-transaction cap primitive. The single-payment Finance threshold is therefore enforced before attempting the chain spend; refused payments become Finance decisions.
- Local-cookie note: production HTTPS cookies include `Secure`; local `http://localhost:8790` omits `Secure` so browser testing can sign in.

## Pass 6A Personal Money and Pay-to-Stocks
| Feature | Result | Evidence |
|---|---|---|
| Personal accounts | WORKS | Seeded people now receive deterministic personal P256 accounts derived from the server secret, state epoch and person id. Payday pays those addresses; state stores no key material. Passkeys remain department spending keys for now; future path is passkey-as-personal-root once Tempo exposes a supported root rotation/takeover path. |
| AAPL test asset | WORKS | Company issued `AAPL (test)` at `0x20c00000000000000000000053a961485bd7d796`, create tx `0xc0573954519232db9603eb86596a4b914aef24ab1a8050dafcbd1b24d7e907b9`; DEX pair tx `0x3a30b100c2e10b7bc4f4a97ae7c540e5c84aff1ae99f8ed82cd845cfb3a886d3`; mint tx `0x35f1e0c7e5a6eba234ebdad2ecb246170b451b5736b0b2dd6dee7a5720d34afa`; bid tx `0x2c772f371ac3d57073471bc9b12e5375364d9553202990ea164a18b6921bcdac`; ask tx `0x1c5c64c0606075466f6d3b0b6339e9c3c5129da092578b2c6091b4240a72806b`. |
| NVDA test asset | WORKS | Company issued `NVDA (test)` at `0x20c000000000000000000000ad1ddee86c11f107`, create tx `0x58e8735eb2a8b190ddcddf2abcfb77dd86d42d48da723a74097af4c60568597c`; DEX pair tx `0xf1658e655ab09ab87f43a4059415be274811e69ec0ecbffcef6346366e5e9a93`; mint tx `0x2137318da213334d9eaee75a11c4a2818f2092fa5cdc98f13a906cfbc0f2ca4f`; bid tx `0x505511ff83a0d7802c7c6eab739edd0638bd8947e30148e076a88e1bbc30f2cf`; ask tx `0x68954ec3f9259e2e0ac797a6f647a67be9b7d40fc467cc98ceab2a4639fe2c26`. |
| SPY test asset | WORKS | Company issued `SPY (test)` at `0x20c00000000000000000000041c168b180681418`, create tx `0xad729b9923d8ace0b2b40474964d5cb543a46f663644999b10d9668eed734323`; DEX pair tx `0xe44c5474bd66070b01e3bc1a4375e1f8c523d38d542746c52f1d835ea0d900aa`; mint tx `0x68fb8759a9fbb6339d8aa58b7442aba98e06645de89b49a08a75f23d990a21e0`; bid tx `0x6dc12d5a5c2714696608c68a0136fcf3b5aebe93c9c47c14f471f4a416864b27`; ask tx `0xa08ac26a77691a50dec163c930754b3d101eeef0103dcfaa261d15917ab0c3a0`. |
| Pay-to-stocks election | WORKS | `npm run e2e`: Sam's default 20% AAPL election bought `AAPL (test)` exposure after payday, buy tx `0x81a624c61be412406c0651e3530597e113f76789387354f908742d4e7273840a`; state showed 2.83 displayed AAPL shares from $720 at delayed $254. |
| Manual sell | WORKS | `npm run e2e`: Sam sold 0.1 displayed AAPL shares, sell tx `0x17d0ddab819d5ae1f44aaea4861f2cf77dcd83a9f5598b7cb7b3b2b3b36fdefa`; state showed remaining holding, value and gain/loss. |
| Delayed prices | WORKS with fallback | The app tries Stooq CSV for `aapl.us`, `nvda.us`, and `spy.us`; the sandbox run used cached fallback prices and labels them delayed. |
| Earn | SIMULATED | `npm run e2e` exercises `/api/earn/deposit` and receives `mode: "simulated"` with reason: no public pathUSD ERC-4626 venue/factory configuration is available for Moderato in this app. No real Earn deposit tx is claimed. |

## Pass 6A Real vs Simulated
- Real on Moderato: personal payday destinations, TIP-20 test asset creation, DEX pair creation, company bid/ask order placement, pay-to-stocks DEX buy, manual DEX sell, and all prior department/payday/passkey flows.
- App accounting: displayed stock shares, average cost, current value and gain/loss are computed from Teampot trade records and delayed reference prices. DEX inventory is dollar exposure units because Tempo's DEX tick range does not support raw stock prices such as $254 directly.
- Simulated: Earning remains labelled simulated. Mainnet path is to use real tokenized stocks such as Ondo or xStocks once bridged or issued natively on Tempo, plus a public or app-deployed Earn venue for pathUSD.
