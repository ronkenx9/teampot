# Gates: company payment domain
OWNS: app/server/pilot.ts, app/server/pilot-types.ts, app/server/pilot.test.ts
Scope: Isolated permissions and durable testnet payment operations.
- [ ] G1: API domain tests prove both positive flows and isolation, role, retry, ambiguous-send and revoke failures.
  CHECK: npx vitest run server/pilot.test.ts
  CWD: app
  EXPECT: Test Files
  EVIDENCE: pending
