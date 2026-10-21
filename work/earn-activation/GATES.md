# Gates: Isolated OUSD activation preparation

OWNS: app/server/store.ts, app/server/store.test.ts, app/server/deployment.ts, app/server/deployment.test.ts, app/scripts/earn-preflight.ts, app/.env.ousd.example, work/earn-activation/**, PRIVACY_EARN.md

Scope: Prepare isolated OUSD deployment configuration and a read-only account/funding preflight; leave live movement blocked until an authorized funded account is available.

- [x] G1: Mainnet configuration requires isolated storage, demo sign-in disabled and the matching asset/vault; namespaced state cannot collide with the demo.
  CHECK: npx vitest run server/deployment.test.ts server/store.test.ts
  EXPECT: Test Files  2 passed
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=f4a72c504e7a217418f9d5a2f57931538b0524c2792cc6542bfef4f339558f07; exit=0; EXPECT=matched; output-sha256=ef1ed180ef70421ff84ebb0ba315ec8406b4da56be973bc09f450776d0eb58ea; output-bytes=210; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=1de284fe69ab/26 entries

- [x] G2: Existing application tests and type checks remain green.
  CHECK: npm test && npm run typecheck && node -e "console.log('ACTIVATION_CHECKS_OK')"
  EXPECT: ACTIVATION_CHECKS_OK
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=5df53bc6e9ca9a217687e4d7798b0d67d75fa469145aaa5c9e69cb43fbbc66b7; exit=0; EXPECT=matched; output-sha256=b9dbc20d392ac526ff8046b30639da6e65ee3e30a4dec5d3f0448b971c1c234a; output-bytes=315; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=1de284fe69ab/26 entries

- [ ] G3: Read-only preflight verifies vault routing, OUSD and fee balances for the selected account without signing or transmitting a transaction.
  EVIDENCE: pending — account selection needed.

- [ ] G4: An authorized funded account completes a deposit/withdrawal round trip with reconciled evidence.
  EVIDENCE: pending — user confirmed no OUSD funded yet; account selection and funding required.
