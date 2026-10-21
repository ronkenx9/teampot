# Gates: Teampot iOS beta foundation
OWNS: mobile/app/**, mobile/src/components/**, mobile/assets/**, mobile/package.json, mobile/package-lock.json, mobile/scripts/beta-smoke.mjs, mobile/scripts/verify-beta-api.ts, mobile/.gitignore, mobile/HANDOFF.md, work/ios-beta/**
Scope: Explicit testnet beta experience, prepared native builds, verified local UI and honest device/distribution handoff.
- [x] G1: Mobile types and iOS JavaScript/assets bundle compile.
  CHECK: npm run typecheck && npx expo export --platform ios --output-dir dist-ios && node -e "console.log('IOS_BETA_BUNDLE_OK')"
  EXPECT: IOS_BETA_BUNDLE_OK
  CWD: mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=d44508833192b5992cc99026765d600d3595a1c06a1a9a46048d1237e4fa4392; exit=0; EXPECT=matched; output-sha256=fedd5bd255e2315d061a863713e19c5f41d4acb1ca770f2a75ad22fbec5ca03a; output-bytes=1551; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G2: Browser-rendered native screens cover entry, roles, retry, validation, logout and no automatic sign-in.
  CHECK: npm run test:beta
  EXPECT: IOS_BETA_UI_OK
  CWD: mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=2d34a5a3a8e1dfde1700a3018fb5191a9a15f68f3d457e79fad7468facc4d615; exit=0; EXPECT=matched; output-sha256=fa684707b284b99c46b853c22cfcc874e0fe6f815c6f97cc87f34129322b419f; output-bytes=2180; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G3: Reviewed screens satisfy the internal testnet beta scope, and release notes clearly identify unverified native-device and distribution requirements.
  EVIDENCE: work/ios-beta/REVIEW.md; independent reviewer pass after fixes; mobile/BETA.md identifies native QA, signing, distribution and dependency-review limits.

- [x] G4: Actual hosted API establishes and restores a testnet session using native-style cookie transport without financial actions.
  CHECK: node --import ../app/node_modules/tsx/dist/loader.mjs scripts/verify-beta-api.ts
  EXPECT: IOS_BETA_API_OK
  CWD: mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=4fbc4f0076a20c01758cff99eef65944b6aadb1ceb14020e987e383ed4ac0869; exit=0; EXPECT=matched; output-sha256=ac673921da091745b4c264b857c2876bae0c93984bd3ca126b3bb14fa935f812; output-bytes=16; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
