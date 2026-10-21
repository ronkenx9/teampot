# Native onboarding review — 2026-10-20

User contract: concise welcome slides, name before role, system light/dark, spacious welcoming design with soft blur/light/motion, usable Expo Go beta. Root implementation and independent reviewer inspected source and rendered 390×844 light / 375×667 dark flows. Final refinement removed unnecessary introductory labels; maintained light upright Geist, warm paper/nearblack, material cards with lit edges and restrained drift.

Review passed: introductions fit at small viewport after compact artwork fix; four role choices fit; name precedes roles; local tester name is distinct from backend demo records; all existing screens adapt system theme; Reduce Motion starts still and stops looping decoration; background pauses drift. Step changes announce new headings on native. All input/role/control targets have practical touch sizing; name form and long copy scroll above the keyboard-aware action.

Meaningful automated coverage: no launch login, slide progression/skip/back, invalid blank/numeric names, explicit role requirement, name normalized and stored locally, name absent from API login, profile restore/signout, theme changes, reduced-motion stillness, test purchase/invoice/approval/Finance cancel, offline retry and mainnet rejection. Native bundle and config checks pass; independent profile/session tests cover malformed/mismatched/local storage/race cases.

Limits: browser mocks cannot prove physical iOS safe areas, keyboard, VoiceOver focus, native blur/motion or SecureStore. Owner phone opening remains unconfirmed. No native binary or TestFlight upload. Existing Earn/real-money gates remain off.
