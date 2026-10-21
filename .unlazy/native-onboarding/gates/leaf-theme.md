# Gates: System appearance

OWNS: mobile/src/theme.ts, mobile/src/components/ui.tsx, mobile/src/components/Shell.tsx, mobile/app/(tabs)/**, mobile/app.json

Scope: System light/dark theme throughout existing native screens with readable semantic colors.

- [x] G1: Theme and screen migrations typecheck.
  CHECK: npm run typecheck
  CWD: mobile
  EXPECT: tsc --noEmit
  EVIDENCE: automatic-evidence=v1; definition-sha256=4dda57435c6f7e77cf8c8bea358f84229d236549ef89216544222b927ad14938; exit=0; EXPECT=matched; output-sha256=077ecfdd08cd66ba749e3c686382b6edbbfb60a15f9ea852ca7f85d92e721bc0; output-bytes=50; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/teampot/mobile; path=be0ed06db338/29 entries
- [x] G2: Every existing screen and modal uses theme colors, including contrast-safe accent text, status notices, inputs, tab bar and local tester name distinct from demo actor.
  EVIDENCE: Four-pass source review of theme.ts, shared controls, Shell, every tab and its modals: semantic colors replace all hardcoded screen fills/text, input placeholder/selection/keyboard colors adapt, tab scene/background adapt, BrandLogo reversed in dark, app appearance automatic. Contrast check (independent luminance formula with same-white negative control) passed 16 foreground/background pairs: minimum 4.88:1 light muted/paper, accent white/fill 5.54:1 in both; dark muted/soft 7.63:1. Shell shows device-local name; Money labels backend identity as demo account and Settings separates both. Parent integration gate G3 owns rendered screenshot review, not claimed here.
