# Gates: iOS release preparation
OWNS: mobile/app.json, mobile/eas.json, mobile/.env.example, mobile/README.md, mobile/BETA.md, mobile/scripts/check-release.mjs
Scope: Reproducible simulator and TestFlight build profiles with honest release prerequisites.
- [x] G1: Native configuration and EAS profiles agree on beta identity and do not contain invented signing/project credentials.
  CHECK: node scripts/check-release.mjs
  EXPECT: BETA_RELEASE_CONFIG_OK
  CWD: mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=bbbe8acaf00369728cdfb905705b5c331c3a6d82ddd0e11c66dba3f3dcacb19a; exit=0; EXPECT=matched; output-sha256=2a7d310b8e70c165fef413848e61bab9039923525658d7ba25d88f43fbfbca24; output-bytes=23; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G2: Release guide distinguishes bundling, device QA, signing and TestFlight distribution.
  EVIDENCE: Reviewed mobile/BETA.md and mobile/README.md against official Expo simulator/TestFlight documentation on 2026-10-20. Guide separates type/bundle/browser evidence, native build, device QA, signing, upload and Apple processing. Full Xcode and account/project/signing setup remain explicit handoffs; no binary or distribution is claimed.
