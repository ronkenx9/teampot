# iOS beta foundation — 2026-10-20

User confirmed private internal testers first and no Apple Developer membership. This task prepared source for the first testnet beta; it did not distribute an app.

## Four-pass review

1. Complete: deliberate beta entry, role-based tabs and route guards, settings/sign-out, explicit test-fund copy, native-safe-area layout, existing core flows, simulator/TestFlight configuration.
2. Depth: verified identity/network boundaries; no automatic demo login or persona replacement; atomic origin-scoped sessions, persisted action IDs and ambiguous-outcome blocking; restored current lighter brand typography.
3. Correctness: 16 session/transport cases; types; iOS JavaScript/assets export; browser-rendered flows at 375/390; actual hosted testnet login/restore using native-style cookie transport, zero financial actions. SDK-compatible dependency patch versions aligned and Expo dependency check passes.
4. Polish: independent reviewer found approval payment ambiguity, text contrast and a screenshot transition race. All fixed and reviewed again. Approval now confirms vendor, amount, requester, test funds and any vendor-rule change. Restricted lead decisions are disabled with reasons.

## Independent verdict

Pass for the browser-reviewed beta slice. All material findings resolved: approval confirmation, clay text contrast, settled Finance/Settings screenshots and explanations for restricted lead decisions. This is not native release approval.

## Release handoff

No signed native binary or TestFlight upload exists. Owner needs Expo project linking and Apple Developer membership/signing for TestFlight. Full Xcode/iOS Simulator is absent here. Device installation, SecureStore/Face ID, VoiceOver, Dynamic Type, keyboard behavior and background/resume remain unverified. See mobile/BETA.md.

Dependency audit snapshot: dependency-audit.json. It reports 29 advisory entries (18 high,11 moderate,0 critical), including transitive build tooling and routing dependencies. Compatible Expo patch alignment does not eliminate these. Triage/remediation remains a release prerequisite; do not use npm audit --force to roll the framework backward. No blanket security-readiness claim is made.

UI fixture checks never contact payment endpoints on the hosted service. api-results.json records the separate hosted session check. All displayed fixture values in screenshots are test data, not customer financial records.
