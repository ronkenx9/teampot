# Gates: Confidential payroll and surplus earn

OWNS: app/server/**, app/web/src/**, app/scripts/privacy-earn*.mjs, app/scripts/e2e.mjs, app/scripts/audit-ui.mjs, app/scripts/verify-earn-deployment.ts, app/package.json, app/package-lock.json, work/privacy-earn/**, PRIVACY_EARN.md

Scope: Fail-closed confidential payroll controls, Finance-approved surplus reserves, asset-validated vault operations, accurate UI, and explicit evidence for external activation requirements. No Zcash integration.

- [x] G1: Privacy mode rejects public payroll, enforces Finance permissions, and scopes pay records to the recipient.
  CHECK: npx vitest run server/privacy-earn.test.ts
  EXPECT: Test Files  1 passed
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=8ffe49efe3ae6f75f753c902f37c6096545e2189aaaeb7afbc9eba98c8a2e792; exit=0; EXPECT=matched; output-sha256=ee273cdc0e15bb0e159d5da6a6b63c0dee992b55a8766e89c1d3cba6aa5e1fea; output-bytes=198; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=da3c02578c84/31 entries

- [x] G2: Surplus policy preserves reserves and obligations; vault adapter rejects mismatched assets, failed receipts and unavailable liquidity.
  CHECK: npx vitest run server/earn.test.ts
  EXPECT: Test Files  1 passed
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=aeee141bde429b1c6cf62d3521a8263dd76a6edafe3338a752b24fb2eb5d0f40; exit=0; EXPECT=matched; output-sha256=7a4f27e23054c14edcf6cce0b8a00734ceb1cd30dde4c4211c2db1ba5ce2c389; output-bytes=210; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=da3c02578c84/31 entries

- [x] G3: Application tests, types and production web build pass.
  CHECK: npm test && npm run typecheck && npm --prefix web run build
  EXPECT: built in
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=8c6bb74abb1fb91daed7bea934a8769259eaf75859495be551d1fa56d3cdaa52; exit=0; EXPECT=matched; output-sha256=d943a3de3d1699167ed43853b6f4ab17691a14feae8728360a15f9cbd38399aa; output-bytes=2320; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=da3c02578c84/31 entries

- [x] G4: Browser verification covers Finance privacy and earn controls at desktop and phone widths.
  CHECK: node scripts/privacy-earn-check.mjs
  EXPECT: PRIVACY_EARN_UI_OK
  CWD: ../../app
  EVIDENCE: automatic-evidence=v1; definition-sha256=18ae73d05e9e0760b8e81a5f9f1c683d12c78f3d64d628d98417b830a3d856b0; exit=0; EXPECT=matched; output-sha256=f96f94c72cca1b73e7ea043885713d62fe3db92dde53395157ae30df3b5f7005; output-bytes=204; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=da3c02578c84/31 entries

- [ ] G5: Confidential payroll is proven on an authorized current Tempo Zone deployment.
  EVIDENCE: pending — operator access and supported private payroll mechanism required; current preview disables general TIP-20 transfers.

- [ ] G6: OUSD vault asset, chain, interface and a deposit/withdrawal round trip are verified before live activation.
  EVIDENCE: pending — official vault deployment details and authorized test assets required.

ABANDON: G5 User confirmed no Tempo Zones preview access. Current runtime disables general private TIP-20 transfers. Operator access and supported payroll tooling are required; no confidential payroll activation claimed.
ABANDON: G6 Mainnet read-only probe verified OUSD asset, decimals, dead shares and deployed SDK bundle target. No funded OUSD round trip: existing deployment uses pathUSD test funds. A funded staging/deployment acceptance run remains required; no live activation claimed.
