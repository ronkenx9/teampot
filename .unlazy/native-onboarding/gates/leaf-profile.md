# Gates: Local tester profile

OWNS: mobile/src/TeampotProvider.tsx, mobile/src/betaProfile.ts, mobile/scripts/profile-tests.ts

Scope: Local name personalization tied to a verified demo persona, never server privileges.

- [x] G1: Profile validation/storage/matching/logout behavior passes meaningful negative and positive cases; existing session safety tests pass.
  CHECK: node --import ../app/node_modules/tsx/dist/loader.mjs scripts/profile-tests.ts && npm run test:sessions
  CWD: mobile
  EXPECT: SESSION_TESTS_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=4656413e8f98966a7c5de3ede85f44a8960cc3211cd81d3f133e63280e1e3c11; exit=0; EXPECT=matched; output-sha256=2f1d17fe177871e85d6087bf9818e8cf37a1d296d9bf290dbbf70376d98b53b6; output-bytes=2170; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
