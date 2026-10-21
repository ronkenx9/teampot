# Teampot iOS beta foundation — revision 2

User intent: start building the Teampot iOS beta. Preserve current web/backend work and Zcash exclusion. First slice is an explicitly testnet internal beta; real-account browser onboarding remains separate, no live money or earn activation. User confirmed private internal testers and no Apple Developer membership. No signing, upload or distribution in this slice without configured accounts.

## Contract
| ID | Required outcome | Owner | Observation | Disposition |
|---|---|---|---|---|
| C1 | Explicit beta entry, native safe-area shell, role navigation, settings/logout, accessible validated core flows | root | GATES:G1,G2 | active |
| C2 | Restore only authenticated sessions, fail closed outside testnet demo, no fabricated persona, serialized mutations, session cleanup | leaf-api | leaf-api:G1 | active |
| C3 | Simulator and TestFlight profiles, reviewed native config, reproducible release steps without invented credentials | leaf-release | leaf-release:G1,G2 | active |
| C4 | Verify types, iOS bundle, UI actions/error states and report device/distribution limits | root | GATES:G1,G2,G3 | active |

## Interfaces
Provider retains existing action methods, adds sessionStatus: 'restoring'|'signedOut'|'signedIn', signOut():Promise<void>, error:string|null; personId remains string. loading prevents actions. refresh failures preserve authenticated session for retry but clear stale financial data. Session only from /api/auth/demo, state must auth.demo===true with matching person, earn.network==='testnet' (or explicit company.network==='testnet'); unknown network fails closed. Public API exposes environment info, local logout clears credential + persona; never auto-relogin expired sessions. Root uses existing warm Teampot palette and current lighter typography, not a rebrand.

## Tree
- beta
  - api
  - release
  - root UI + integration

## Dispatch
| Leaf | Owns | Needs | Tier | Planned wave | State |
|---|---|---|---|---|---|
| leaf-api | mobile/src/api.ts, mobile/src/TeampotProvider.tsx, mobile/src/types.ts, mobile/src/sessionCore.ts, mobile/scripts/session-tests.ts | none | judgment | ready-1 | VERIFIED |
| leaf-release | mobile/app.json, mobile/eas.json, mobile/.env.example, mobile/README.md, mobile/BETA.md, mobile/scripts/check-release.mjs | none | judgment | ready-1 | VERIFIED |

Root owns remaining mobile UI, assets, package scripts, beta smoke script, work/ios-beta and ledgers. Generated .expo/dist outputs are not source ownership. No concurrent package installs/exports.
