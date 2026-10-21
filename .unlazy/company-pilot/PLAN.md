# Plan: Two-company Tempo testnet pilot and iPhone connection

Scope: company-pilot
Depth: tree 2
Mode: orchestrated

## Contract
- Host: Codex native agents, three independent implementation leaves plus driver integration.
- Preserve existing uncommitted work, shared demo and disabled live earning. Testnet only; no real funds.
- API/adapter/UI interfaces are fixed in work/company-pilot/CONTRACT.md. Driver owns auth/mobile pairing, workspace-store additions, Tempo adapter, live verification and documentation. Leaves may read all files; write only OWNS.
- Toolchain: existing Node/npm/tsx/vitest and Expo. Root is teampot. No new native module required for Expo Go.
- Four passes: complete, deepen, correctness/integration, polish. Driver independently reviews money/security and re-runs gates.

## Current contract inventory
Contract revision: 1
| ID | Required outcome or constraint | Owner | Observing gate or manual review | Disposition | Revision |
|---|---|---|---|---|---|
| C1 | Isolated company treasury, department, head/card, payment, approval, revoke and receipts | 1.1 | 1.1:G1, root:N3 | ACTIVE | 1 |
| C2 | Current permissions, no cross-company access, no self-approval or duplicate payments | 1.1 | 1.1:G1, root:N2 | ACTIVE | 1 |
| C3 | Usable existing web workspace flow | 1.2 | 1.2:G1, root:N4 | ACTIVE | 1 |
| C4 | Expo Go real account connection, assigned roles, same pilot flow, durable retries | 1.3 | 1.3:G1, root:N4 | ACTIVE | 1 |
| C5 | Testnet only, separate demo, no real earn activation | driver | root:N2,N3 | ACTIVE | 1 |
| C6 | Two independent companies complete actual Tempo transactions | driver | root:N3 | ACTIVE | 1 |
| C7 | Phone-accessible server and Expo entry with honest actual device verification status | driver | root:N5 | ACTIVE | 1 |

## Tree
- 1 Company pilot ... GATES.md
  - 1.1 Payment domain ... gates/leaf-1.1.md
  - 1.2 Web workflow ... gates/leaf-1.2.md
  - 1.3 iPhone workflow ... gates/leaf-1.3.md

## Leaf dispatch table
| Leaf | Owns | Needs | Tier | Planned wave | State |
|---|---|---|---|---|---|
| 1.1 | app/server/pilot.ts, app/server/pilot-types.ts, app/server/pilot.test.ts | - | judgment | 1 | IN-FLIGHT |
| 1.2 | app/web/src/Workspace.tsx, app/web/src/Pilot.tsx, app/web/src/pilot.css | - | judgment | 1 | IN-FLIGHT |
| 1.3 | mobile/app/_layout.tsx, mobile/src/pilot/**, mobile/scripts/pilot-tests.ts, mobile/HANDOFF.md, mobile/README.md | - | judgment | 1 | IN-FLIGHT |

Driver: app/server/workspaces.ts, app/server/workspace-store.ts, app/server/pilot-tempo.ts, app/server/mobile-pairing.ts and tests, app/scripts/pilot-*.ts, docs and integration. No leaf ownership overlaps.
