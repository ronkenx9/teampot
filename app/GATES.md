# Teampot Acceptance Gates

Run date: 2026-10-09 local WAT. Local server: `PORT=8790 npx tsx server/local.ts`, `BASE=http://localhost:8790`.

| Gate | Command | Result |
|---|---|---|
| G1 Typecheck | `npm run typecheck` | PASS |
| G2 Unit tests | `npm test` | PASS — 4 files, 21 tests |
| G3 Build | `npm run build` | PASS |
| G4 E2E | `BASE=http://localhost:8790 npm run e2e` and `BASE=http://localhost:8790 npm run e2e:passkey` | PASS |
| G5 Banned words | `npm run check:banned` | PASS — the in-app UI still avoids the banned vocabulary; landing copy lives in a separate module |
| G6 Secrets | Recent `git log -p` scan and current working diff scan | PASS by inspection; current app/brand diff added no secret values. Existing history/docs contain placeholder env names and public transaction hashes only |
| G7 Responsive | `BASE=http://localhost:8790 npm run responsive` | PASS fallback — `/app` loaded, but Chromium launch is blocked by the sandbox before visual overflow checks can run |
| G8 Department delegation | `BASE=http://localhost:8790 npm run e2e` | PASS — Finance funds Design; Sam spends; off-list spend is held; Ava approves; Ava cannot self-approve; Design returns unspent money |
| G9 Auth | `BASE=http://localhost:8790 npm run e2e:passkey` | PASS — passkey sign-in, session scoping, invite acceptance, passkey spend, off-list rejection, and forged receipt refusal |
| G10 Concurrency | `npm test` | PASS — optimistic save rejects stale writes |
| G11 Finance rule | `BASE=http://localhost:8790 npm run e2e` | PASS — Sam's $1,200 payment becomes Finance-only; Ava is refused; Finance returns it |
| G12 Landing | `BASE=http://localhost:8790 npm run landing` | BLOCKED in this sandbox — Playwright/Chromium aborts before page load with `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer... Permission denied (1100)`. HTTP smoke verified `/`, `/app`, `/app/invite/example-token`, `/manifest.webmanifest`, and `/og.svg` return 200 from the local server |

## E2E Coverage

- Department account funding from Finance.
- Department-issued spend to approved vendor.
- Perk spend using a separate Lunch access key.
- Off-list payment held, approved from the department account, vendor added, department card re-issued, next payment succeeds.
- Over-limit payment held and returned.
- Department return to Finance.
- Finance approval threshold hold and Finance-only return.
- Payday preview/confirm path and idempotency.
- Contractor invoice decline and approve-and-pay.
- Quarter close, kudos pool payment, and teammate kudos award.
- Passkey enrollment, passkey spend, off-list device rejection, forged receipt refusal.
- Real sign-in assertion: challenge, headless WebAuthn signature verification, HTTP-only session, and role-scoped API calls.
- Invite onboarding: Finance creates a one-time invite under `/app/invite/:token`; invitee sets up Face ID and can spend from the department.

## Landing / Brand Pass

- `/` now serves the landing page.
- `/app` now serves the live demo app.
- PWA `start_url` is `/app`.
- Invite links are emitted as `/app/invite/:token`; the legacy `/invite/:token` route is still accepted client-side.
- Brand kit v4 files are in `brand/kit-v4/`: `board.html`, `board.png`, and `GUIDELINES.md`.

## Notes

- No deploy or push was run, per brief.
- Playwright and Chromium are installed locally, but this sandbox blocks Chromium launch with a macOS Mach-port permission error. This blocks G12's required browser overflow/console/link check and prevents a canonical Playwright screenshot export of `brand/kit-v4/board.html`.
