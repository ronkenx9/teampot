# Gates: two-company testnet pilot integration
Scope: Deliver complete real account spending flow on web and Expo Go with actual chain evidence.
- [ ] N1: All three implementation leaves independently reverified.
  CHECK: node ../.agents/skills/unlazy/scripts/gate-check.mjs --root . --cwd . --reverify .unlazy/company-pilot/gates/leaf-1.1.md .unlazy/company-pilot/gates/leaf-1.2.md .unlazy/company-pilot/gates/leaf-1.3.md
  EXPECT: ALL MET
  EVIDENCE: pending
- [ ] N2: API regressions, authentication/security checks and both app typechecks pass.
  CHECK: npm run typecheck && npm test && npm --prefix ../mobile run typecheck
  CWD: app
  EXPECT: Test Files
  EVIDENCE: pending
- [ ] N3: Independent companies complete real testnet funding, delegation, payment, approval and revocation with durable receipt evidence.
  CHECK: npx tsx scripts/pilot-live.ts --verify
  CWD: app
  EXPECT: two-company testnet evidence verified
  EVIDENCE: pending
- [ ] N4: Browser and native-export interfaces reviewed against the same backend, role permissions, device pairing, errors and persisted receipts.
  EVIDENCE: pending
- [ ] N5: Phone-accessible API and Expo Go link verified; actual physical-device test status explicitly recorded in handoff.
  EVIDENCE: pending
- [ ] N6: Claims audit, all leaves settled and exact ownership leases released after parent verification.
  EVIDENCE: pending
