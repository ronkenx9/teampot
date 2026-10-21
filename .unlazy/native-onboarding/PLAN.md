# Native onboarding — revision 1

Contract: deliver digestible welcome slides, name then role, locally personalized testnet beta, system light/dark throughout, soft restrained motion and lit edges, accessible small-screen layout, Expo Go phone connection. No real financial authorization from role selection; no mainnet or Zcash. Preserve existing app behavior and dirty work.

| ID | Outcome | Owner | Observation | Disposition |
|---|---|---|---|---|
| C1 | Welcome slides then name then role; no initial persona picker | root | GATES:G1,G3 | active |
| C2 | Local name persists with verified session, logout clears it, never changes backend identity | leaf-profile | leaf-profile:G1 + GATES:G1 | active |
| C3 | System appearance across native app, readable accessible controls | leaf-theme | leaf-theme:G1,G2 + GATES:G3 | active |
| C4 | Premium spacious motion with reduced-motion support and keyboard usability | root | GATES:G1,G3 | active |
| C5 | iOS build, existing beta regressions, reachable Expo Go link | root | GATES:G1,G2,G4 | active |

Interfaces: src/theme.ts exports useTheme(): {colors, isDark}, type ThemeColors. colors retain clay,clayDark,ink,paper,line,muted,soft and add onAccent,error,tint,tintLine,overlay as needed. No global mutation. Root BetaEntry consumes useTheme. Provider exposes betaProfile: {name:string,personId:string}|null and completeOnboarding(name:string,personId:string):Promise<boolean>. Store locally separate from demo credentials; name must never alter server people/auth. Shell/settings use betaProfile?.name for local tester identity while server actor remains explicit demo identity. Root guards sessionStatus !== signedIn OR !betaProfile. Sign-out clears profile; invalid/mismatched restore profile never skips onboarding.

## Tree
- native-onboarding
  - profile
  - theme
  - root welcome + integration

## Dispatch
| Leaf | Owns | Needs | Tier | Planned wave | State |
|---|---|---|---|---|---|
| leaf-profile | mobile/src/TeampotProvider.tsx, mobile/src/betaProfile.ts, mobile/scripts/profile-tests.ts | none | judgment | ready-1 | VERIFIED |
| leaf-theme | mobile/src/theme.ts, mobile/src/components/ui.tsx, mobile/src/components/Shell.tsx, mobile/app/(tabs)/**, mobile/app.json | none | judgment | ready-1 | VERIFIED |

Root owns BetaEntry, new onboarding components, app/_layout.tsx, package files, browser tests, docs and work artifacts. Root alone installs dependencies and exports bundles. Agent checks must not export. Shared integration checks run after leaves settle.
