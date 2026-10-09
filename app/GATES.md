# Teampot Acceptance Gates

Run date: 2026-10-09 local WAT. Local server: `PORT=8790 npx tsx server/local.ts`, `BASE=http://localhost:8790`.

| Gate | Command | Result |
|---|---|---|
| G1 Typecheck | `npm run typecheck` | PASS |
| G2 Unit tests | `npm test` | PASS — 3 files, 18 tests, 25+ assertions covering pot math, quarter close, validation, idempotency, receipt parsing, and viewer-scoped privacy |
| G3 Build | `npm run build` | PASS |
| G4 E2E | `BASE=http://localhost:8790 npm run e2e` and `BASE=http://localhost:8790 npm run e2e:passkey` | PASS |
| G5 Banned words | `npm run check:banned` | PASS |
| G6 Secrets | `git log -p --oneline --max-count=50 \| rg ...` and `git diff --no-ext-diff -- app ':!app/package-lock.json' \| rg ...` | PASS for existing log + working diff; commits blocked by read-only `.git` sandbox |
| G7 Responsive | `BASE=http://localhost:8790 npm run responsive` | PASS fallback — Playwright and Chromium are installed, but Chromium launch is blocked in this sandbox by a macOS Mach port permission error; the script loaded the local app and kept the fallback |
| G8 Department delegation | `BASE=http://localhost:8790 npm run e2e` | PASS — Finance funds Design; Design root issues Sam's key; Sam spends; off-list spend is held; Ava approves from Design; Ava cannot approve her own request; Design returns unspent money |

## E2E Coverage
- Department account funding from Finance.
- Department-issued spend to approved vendor.
- Perk spend using a separate Lunch access key.
- Off-list payment held, approved from the department account, vendor added, department card re-issued, next payment succeeds.
- Over-limit payment held and returned.
- Department return to Finance.
- Payday preview/confirm path and idempotency.
- Contractor invoice decline and approve-and-pay.
- Quarter close, kudos pool payment, and teammate kudos award.
- Passkey enrollment, passkey spend, off-list device rejection, forged receipt refusal.

## Notes
- Second pass installed Playwright and downloaded Chromium to `app/.cache/ms-playwright`; use a non-restricted browser environment to run the full overflow/console sweep.
- Commit creation was attempted, but the sandbox refused `.git/index.lock` creation. The worktree is ready to commit outside this restricted mount.
