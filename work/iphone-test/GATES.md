# Gates: Teampot on the owner's iPhone
OWNS: mobile/scripts/phone-link.mjs, mobile/package.json, mobile/package-lock.json, mobile/README.md, mobile/BETA.md, work/iphone-test/**
Scope: Serve the existing testnet beta to compatible Expo Go on a physical iPhone without paid Apple membership, and verify connection readiness before device handoff.
- [x] G1: Existing app types and installed Expo SDK compatibility check pass.
  CHECK: npm run typecheck && npx expo install --check && node -e "console.log('PHONE_COMPATIBILITY_OK')"
  EXPECT: PHONE_COMPATIBILITY_OK
  CWD: ../../mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=5f426397e918e0fc56141b44f95ac1f49c46d882b256930692fcf8f73ccfa761; exit=0; EXPECT=matched; output-sha256=1fd4adaa6b5a42b0aaa47c95882b96d8d60755259812012662cec174720d8271; output-bytes=101; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G2: Running server serves an SDK57 iOS manifest and its bundle, and the provided QR encodes the actual connection URL.
  CHECK: node scripts/phone-link.mjs
  EXPECT: PHONE_LINK_READY
  CWD: ../../mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=92a3939c5d8ef3965de60abc087d3f0cb86d88bd9d17f4faf35e881ec9924381; exit=0; EXPECT=matched; output-sha256=db81fd2865c7ab2f3d0cfe68efe2dc2a83ec63825574f2cbd149c27c2dccd066; output-bytes=55; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [ ] G3: Owner confirms Teampot opens on their iPhone.
  EVIDENCE: pending — physical device access belongs to owner.
