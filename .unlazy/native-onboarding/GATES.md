# Gates: Native onboarding integration

Scope: User-requested native welcome flow and phone-testable beta.

- [x] G1: Browser journeys cover slides, name validation, role choice, local profile restore/logout, both appearances, reduced motion, existing beta actions and fail-closed boundaries.
  CHECK: npm run test:beta
  CWD: mobile
  EXPECT: BETA_UI_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=f3549fb767ae9588a3cb61480a052c145b461e93ea3359f844076973b077a2c8; exit=0; EXPECT=matched; output-sha256=271e3422bbf313f04372dfda2668319a27e6d81fa6911f8b6687d4bae6cba13e; output-bytes=2348; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G2: Typecheck and iOS bundle succeed with Expo Go compatible dependencies.
  CHECK: npm run typecheck && npm run export:ios && npm run check:release
  CWD: mobile
  EXPECT: BETA_RELEASE_CONFIG_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=88f84cb142014fea78904173e541d7c449111e1bbe6484880cbde0532e3e4dea; exit=0; EXPECT=matched; output-sha256=2afdf8b7c31d1f96898256489b88fcbfeab43d69b02f142380fc2d55e06fc290; output-bytes=1882; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G3: Rendered small-screen light/dark onboarding and core screens reviewed independently; name-first order, clear copy, spacing, legibility, keyboard and reduced-motion implementation pass.
  EVIDENCE: work/native-onboarding/REVIEW.md; independent onboarding_review inspected source and fresh light390×844/dark375×667 screenshots, no consequential blockers. Native device-only limits explicit.
- [x] G4: Fresh iOS Expo tunnel manifest and bundle reachable; scannable QR generated.
  CHECK: node scripts/phone-link.mjs
  CWD: mobile
  EXPECT: PHONE_LINK_READY
  EVIDENCE: automatic-evidence=v1; definition-sha256=84495706c20ab06e524263b4084d10d2b0410a6f3375424494ab36c6275495ad; exit=0; EXPECT=matched; output-sha256=db81fd2865c7ab2f3d0cfe68efe2dc2a83ec63825574f2cbd149c27c2dccd066; output-bytes=55; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries

Physical iPhone opening remains owner confirmation; this gate proves distribution reachability only.
