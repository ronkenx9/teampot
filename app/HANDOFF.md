# Teampot Handoff

## Built
- Finance management: add vendors, add people, edit pot limits/vendor lists, add perks, next payday setting, payday preview/confirm, payday history, CSV export, and receipt detail sheet.
- Team lead flow: approve, return, or approve-and-add held payments. Approve-and-add pays immediately and updates the team vendor list.
- Perks: separate per-person access keys for allowances such as Lunch and Learning, shown as separate employee cards.
- Quarter close: computes savings from remaining limits, pays a configurable kudos pool, shows leaderboard, and lets teammates award kudos.
- Contractor portal: invoice statuses, paid-in-seconds badge, and decline-with-reason.
- Production readiness: zod validation, 404s for unknown ids, 5s read cache for balances/limits, write invalidation, request-id idempotency for pay paths, unit tests, e2e extensions, banned-word script, responsive script, and docs.
- Brand polish: inline SVG Teampot mascot states, skeleton loading, empty/error states, pending buttons, focus styles, and responsive layouts.

## Real vs Simulated
- Real on Moderato: payday, contractor pay, pot spends, perk spends, held payment approval, approve-and-add with card re-issue, quarter-close pool payment, teammate kudos award, passkey enrollment/spend, and server receipt verification.
- Simulated: earned while unspent. It is visibly labelled simulated because no public test vault is available.
- Not fully proven: passkey public-key re-issue after a pot vendor-list change. Teampot attempts it; if Tempo refuses reuse after revoke, the UI asks the person to turn Face ID on again.

## Key Decisions
- Demo team cards now rotate derived key versions on re-issue. Tempo returned `KeyAlreadyRevoked` when the same revoked key was authorized again.
- Perks use separate derived P256 keys rather than trying to stack multiple limits on a single key.
- Quarter close pays the pool split to teammates and also creates app-side kudos credits for teammate awards; awards are real company-paid payments.
- Responsive gate has a Playwright path and a documented fallback because Playwright is not installed in this repo.

## Gate Results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (3 files, 17 tests, 25+ assertions).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`; PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G5 Banned words: PASS, `npm run check:banned`.
- G6 Secrets: PASS for existing log and working diff scans; commit creation is blocked because `.git` is read-only in this sandbox.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`.

## Known Gaps
- Playwright and Chromium are installed locally, but this sandbox blocks Chromium launch; automated pixel/overflow checks still need a non-restricted browser environment.
- Earned while unspent is demo-only.
- No deployment was run, per brief.
- Requested commits were not created because Git could not create `.git/index.lock` under the current sandbox. Suggested commit chunks: backend/tests/gates, UI/product polish, docs/handoff.

## Second pass
- Privacy: `/api/state` now accepts `?viewer=<person id>` and scopes money server-side. Finance sees everything. Leads see their team pot surface plus their own payday line. Employees and contractors see only their own people record, payday line, spends, holds, kudos/perks, and invoices. Receipts and CSV export use the same viewer scope when the client calls them.
- Regression coverage: added a unit test that runs payday, loads `?viewer=sam`, and proves Sam receives only his $3,600 line with no $16,500 company payroll total and no other staff names/salaries.
- Finance layout: rebuilt Finance as sectioned app navigation with desktop left sidebar and mobile bottom tabs: Overview, Payday, Pots & perks, People, Contractors, Quarter close, and Activity. The previous long admin page is gone.
- Brand v2 pass: stronger Clay/Butter/Sage/Cream blocks, full-sheet payday celebration with cheering mascot and count-up total, guarding mascot in held-payment toast/card, quarter-close mascot moment with a CSS burst, napping empty states, and friendlier employee/contractor phone greetings.
- Feed polish: feed details no longer repeat the pot name from the memo, rows wrap to two lines on mobile, and the receipt sheet carries the full detail plus memo.
- G7: `playwright` is now an app dev dependency and Chromium downloaded successfully into `app/.cache/ms-playwright` (ignored). The sandbox blocks browser launch with a macOS Mach port permission error, so the responsive script falls back to loading the app and documenting the limitation.

## Second pass gate results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (3 files, 18 tests, 25+ assertions).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`; PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G5 Banned words: PASS, `npm run check:banned`.
- G6 Secrets: PASS, recent `git log -p` and working diff scans found no private-key/blob/reset-token values.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`; Playwright installed and browser downloaded, but Chromium launch is blocked by sandbox permissions.
