# Gates: Teampot Pass 6A Wallet

OWNS: app/**

Scope: build personal money accounts, test stock investing, pay-to-stocks, earn handling, docs, and verification for pass 6A.

- [x] G0: this ledger states runnable outcomes
  CHECK: node ../../.agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=aa01785ac688b74f7d7ce6fd7ed11268a0f8873c1deae0169377871a40cbd49a; exit=0; EXPECT=matched; output-sha256=48630b7361dd44ee870917b12c3d19b9d7bdea738aaca16bb04d4cab83b772d2; output-bytes=8; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G1: server and web types compile
  CHECK: npm run typecheck
  EXPECT: tsc --noEmit
  EVIDENCE: automatic-evidence=v1; definition-sha256=f3a9f72cca7186327f0d2cf2bb0c6765c563f0877f0c6b6c7f2096788006be4d; exit=0; EXPECT=matched; output-sha256=d0522ff87c41499c0451c63a5a33133410594faa3be8e5e25cfb7b42812d12b3; output-bytes=59; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G2: unit tests pass with wallet math coverage
  CHECK: npm test
  EXPECT: Test Files
  EVIDENCE: automatic-evidence=v1; definition-sha256=8d7468a94dd45764f3c446f5b031f8f9ee736cf15d57e55462950f447f7c5245; exit=0; EXPECT=matched; output-sha256=d5158ff70906f61bba864781f363b61c69f484144c609b573534db333beb73c0; output-bytes=235; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G3: production web build succeeds
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=46d72eccd628b28a4b0e974e69890ad856bb5d28a16876531804fc540a571513; exit=0; EXPECT=matched; output-sha256=b890c043a00592d2695d9087b1836d859de335a66df3cfa16a4de431adbcbb0d; output-bytes=1553; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G4: Moderato e2e covers payday election, DEX buy, manual sell, and existing flows
  CHECK: BASE=http://localhost:8790 npm run e2e
  EXPECT: e2e ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=1101eec8d9fe98d8f19abee9c34de5dcba35ff2b85c006937fe8dd91d0eeb3f6; exit=0; EXPECT=matched; output-sha256=27461d8e11530d687775148c4ae8404ed721c271066f7ad2d3350eefed5777ee; output-bytes=4594; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G5: passkey e2e still passes
  CHECK: BASE=http://localhost:8790 npm run e2e:passkey
  EXPECT: passkey e2e ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=ee21e4b00d0b8d29a48227e1093e5c9a4d8b955c099fa231fa653aa41d211214; exit=0; EXPECT=matched; output-sha256=29d8f5e8af932f671c4f77df92e0757e4a6bcc02bc46efe466829d111f50e199; output-bytes=835; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G6: visible app copy avoids banned crypto words
  CHECK: npm run check:banned
  EXPECT: No banned user-visible words found.
  EVIDENCE: automatic-evidence=v1; definition-sha256=1a4ed6bcd59652b5609721816e45c61e189d96a0733faf18e5ba91097a9742de; exit=0; EXPECT=matched; output-sha256=a0c3dc79037cfa7520165ce079cafc1f3c6816f66944b408a30401a626985136; output-bytes=88; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G7: responsive script still reaches the app or records the Chromium sandbox fallback
  CHECK: BASE=http://localhost:8790 npm run responsive
  EXPECT: responsive
  EVIDENCE: automatic-evidence=v1; definition-sha256=f0ef4d83202df3a5e24e7addc83f2e2a85d834df371b9712939338e10b496959; exit=0; EXPECT=matched; output-sha256=11758b03cdd279bb56f8b92c81d0528e79675dab020f6bb458107598c8e6704e; output-bytes=241; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G8: landing script still passes or records the Chromium sandbox fallback
  CHECK: BASE=http://localhost:8790 npm run landing
  EXPECT: landing
  EVIDENCE: automatic-evidence=v1; definition-sha256=82af9acff69e678b6d9b17e08c1381d501aeee004549438f50ee57d9acf3ccc4; exit=0; EXPECT=matched; output-sha256=032dd402d79ad475959f0261435ce8ee83b7c6784fdf6407ae39f65c808740fd; output-bytes=246; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries

- [x] G9: HANDOFF and VERIFIED document pass 6A real-vs-simulated status
  CHECK: node -e "const fs=require('fs'); const h=fs.readFileSync('HANDOFF.md','utf8'); const v=fs.readFileSync('VERIFIED.md','utf8'); if(!/Pass 6A/i.test(h)||!/Pass 6A/i.test(v)||!/Earn/i.test(v)) process.exit(1); console.log('docs updated')"
  EXPECT: docs updated
  EVIDENCE: automatic-evidence=v1; definition-sha256=dbfa43522955b6eb95c16e6d96fd48fc04c27dada11a7f79558ad83f1cc240fb; exit=0; EXPECT=matched; output-sha256=adb244a1eca5d5464c0f9bc96f8d5920305224e39f498f80150ce01c99803e00; output-bytes=13; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/app; path=d16069be895d/25 entries
