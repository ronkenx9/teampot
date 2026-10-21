# Gates: Beta sessions and requests
OWNS: mobile/src/api.ts, mobile/src/TeampotProvider.tsx, mobile/src/types.ts, mobile/src/sessionCore.ts, mobile/scripts/session-tests.ts
Scope: Native testnet beta session boundaries and safe mutation lifecycle.
- [x] G1: Session tests reject mismatched actors and mainnet/unknown networks, clear expired credentials, serialize actions and preserve request errors.
  CHECK: node --import ../app/node_modules/tsx/dist/loader.mjs scripts/session-tests.ts
  EXPECT: BETA_SESSION_TESTS_OK
  CWD: mobile
  EVIDENCE: automatic-evidence=v1; definition-sha256=8041b9818b8d6e0784d4449150653ccecbdf5f37e31e42d319d6efcc90d97ece; exit=0; EXPECT=matched; output-sha256=d6af71317154fd8d756bad5daa40e61a3d3066bb5df6795ef82697c56af775dc; output-bytes=1109; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
