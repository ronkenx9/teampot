# Gates: company iPhone workflow
OWNS: mobile/app/_layout.tsx, mobile/src/pilot/**, mobile/scripts/pilot-tests.ts, mobile/HANDOFF.md, mobile/README.md
Scope: Expo Go securely pairs real accounts and performs the company pilot flow.
- [ ] G1: Session/action logic checks prove durable retry, isolation and testnet guards.
  CHECK: node --import ../app/node_modules/tsx/dist/loader.mjs scripts/pilot-tests.ts
  CWD: mobile
  EXPECT: pilot mobile checks passed
  EVIDENCE: pending
- [ ] G2: iOS JavaScript and assets export.
  CHECK: npm run export:ios
  CWD: mobile
  EXPECT: Exported:
  EVIDENCE: pending
