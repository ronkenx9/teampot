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

## V3: Every Team Runs Its Own Money
- Architecture: each department is now a funded Tempo account with a server-held demo P256 root derived from `OPERATOR_PK` + state epoch. Finance funds the department with a real transfer; the department root issues member cards and perk cards.
- Probe first: added `scripts/probe-dept.ts` and proved Finance funding, department-root key issuance, approved member spend, off-list rejection, and department return on Moderato.
- Product: Finance and department heads now see an org map with the Fill block mark. Finance can fund or return department budget. Employees and contractors stay on phone-first views.
- Design: mascot components and mascot copy were removed. Palette is Clay, Ink, Paper, and neutrals; Butter/Sage blocks are no longer used as product colors.
- Preserved flows: payday remains company-paid; member/perk spends, approve-and-add, quarter-close pool, teammate kudos, passkey spending, and held approvals now use the department account where applicable. Contractor pay remains company-paid unless a later hiring-department field is added.

## V3 Real vs App-Enforced
- Real on Moderato: department funding, department-issued P256/member keys, department-issued passkey keys, vendor allowlists, per-period limits, member spends, perk spends, department approval payments, department returns, quarter-close/kudos payments from the department account, payday, contractor pay, receipt verification.
- App-enforced: eligible approver rules, "no self approval", viewer-scoped privacy, and any future company-wide policy such as "payments over $X need Finance".
- Honest gap: true department-root takeover with a head's Face ID is not implemented on Moderato t5. The current honest version is a demo server-held department root plus the head's Face ID as a department-issued spending key. Admin/root-key takeover should be revisited when Tempo exposes the needed supported path.
- Simulated: earned while unspent remains visibly labelled simulated.

## V3 Gate Results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (3 files, 18 tests).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`; PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G5 Banned words: PASS, `npm run check:banned`.
- G6 Secrets: PASS by inspection/scan: no private-key, blob-token, or reset-token values added; tx hashes and placeholder env names appear in docs/tests only.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`; Chromium launch remains blocked by sandbox permissions.
- G8 Department delegation: PASS inside `npm run e2e`: Finance funds Design; Design root issues Sam's key; Sam spends; off-list spend is held; Ava approves from Design; Ava cannot approve her own request; Design returns unspent money.

## Pass 4: Product-Ready Sessions, Invites, Rules
- Real sessions: added passkey challenge/verify sign-in, HTTP-only SameSite session cookies, `/api/me`, logout, and a visible Demo mode. Public demo switching now sets a demo session; real API state and writes authorize from the session role rather than trusting `viewer` params.
- Invites: Finance or a department head can create one-time expiring invite links. The invitee sets up Face ID, lands in their own wallet, and the new passkey is issued as their department spending key.
- Authorization matrix: Finance controls company/payday/vendor/global funding; department heads control their own department and cannot self-approve; employees/contractors can only act for themselves. Unit tests cover cross-person and cross-department refusals.
- Company setup: first run can set a company name from the UI and the setup API accepts a full fresh-company payload with departments, heads and invitees. The default path still keeps Northwind Studio as the demo seed, funds departments, issues department keys/perks, and creates a Finance demo session.
- Finance rule: `company.financeApprovalThreshold` defaults to $1,000. Payments above it are held as Finance-only decisions before a chain spend is attempted. Tempo Moderato per-transaction caps were not used; this is app-enforced and documented in VERIFIED.
- Departments: heads can invite/remove members, update their department settings, request top-ups, return funds, export department activity, and manage perks/vendors. Removing a member revokes the department key when one exists and clears their sessions.
- Contractors: seeded contractors now belong to departments; paying Mateo's invoice pays from Design instead of the company account.
- Robustness: state now has optimistic versions; saves reject stale base versions, with unit coverage. Added in-memory rate limits for sign-in, invite, setup and reset surfaces, structured server error logging without secrets, and `/api/health`.
- Mobile app: added web manifest, theme colour, service worker, offline shell, cached-state first paint, and invite acceptance page.

## Pass 4 Real vs App-Enforced
- Real on Moderato: department/passkey spends, invitee passkey spend, contractor department pay, payday, department funding/returns, approvals, quarter close, kudos, receipt verification.
- App-enforced: sessions/roles, invite one-time use/expiry, Finance threshold, no-self-approval, viewer privacy, and optimistic conflict checks.
- Not implemented as a chain primitive: per-payment ceiling. The app refuses above-threshold payments and records them as Finance decisions.

## Pass 4 Gate Results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (4 files, 21 tests).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`.
- G5 Banned words: PASS, `npm run check:banned`.
- G6 Secrets: PASS by working diff scan; no secret env files edited.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`; browser launch remains blocked by sandbox permissions.
- G8 Department delegation: PASS in `npm run e2e`.
- G9 Auth: PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G10 Concurrency: PASS in `npm test` via `server/store.test.ts`.
- G11 Finance rule: PASS in `npm run e2e`.

## Pass 5: Landing Page and Brand Kit
- Routing: `/` is now a landing page, while the live demo app is under `/app`. The Vite bundle chooses the route client-side and the single Vercel/static fallback still serves both paths.
- PWA and invites: `manifest.webmanifest` now starts at `/app`; the service worker caches `/app`; generated invite links now use `/app/invite/:token`. The client still accepts the legacy `/invite/:token` path so old links do not strand anyone.
- Landing: added a mobile-first landing page with the locked headline/supporting line, problem section, three-step flow, audience rows, Tempo explanation, GitHub link, "Demo company · test money" footer, and "See what's verified" link to `app/VERIFIED.md` on GitHub.
- Product shot decision: Playwright screenshots are blocked in this sandbox, so the landing hero renders product UI components directly with real Teampot demo data and app visual language rather than shipping a broken screenshot placeholder.
- Metadata: added SEO description, Open Graph/Twitter metadata, and `web/public/og.svg` built from the logo mark plus the headline.
- Brand kit: added `brand/kit-v4/board.html`, `brand/kit-v4/GUIDELINES.md`, and `brand/kit-v4/board.png`. The PNG is a static export, not the canonical Playwright screenshot, because Chromium cannot launch here.
- Docs: README now points visitors to `/` for the landing page and `/app` for the demo, and lists the new landing gate.

## Pass 5 Gate Results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (4 files, 21 tests).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`.
- G5 Banned words: PASS, `npm run check:banned`.
- G6 Secrets: PASS by current working diff scan; no secret values added. Recent git history still contains placeholder env names and public tx hashes only.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`; it loads `/app`, then records the Chromium sandbox limitation.
- G8 Department delegation: PASS inside `npm run e2e`.
- G9 Auth: PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G10 Concurrency: PASS in `npm test`.
- G11 Finance rule: PASS inside `npm run e2e`.
- G12 Landing: BLOCKED by environment, not app code. `BASE=http://localhost:8790 npm run landing` aborts before page load because Chromium fails with `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer... Permission denied (1100)`. HTTP smoke verified `/`, `/app`, `/app/invite/example-token`, `/manifest.webmanifest`, and `/og.svg` return 200.

## Pass 5 Known Gaps
- A non-restricted browser environment still needs to run `BASE=http://localhost:8790 npm run landing` to prove no overflow/console errors at 375 and 1280 px and to confirm the landing CTA reaches `/app`.
- Re-export `brand/kit-v4/board.html` with Playwright for the canonical `board.png`; the included PNG is a fallback export because Playwright screenshotting is blocked locally.

## Pass 6A: Personal Wallet and Pay-to-Stocks
- Personal accounts: every person now has a deterministic personal P256 account derived from `OPERATOR_PK` + epoch + person id. Payday pays those accounts, so demo salary can be spent/invested by the server-held personal root. Passkey-as-personal-root is documented as the later supported path; current passkeys still control department spending keys.
- Test stocks: setup issues `AAPL (test)`, `NVDA (test)`, and `SPY (test)` as TIP-20 assets, creates Tempo DEX pairs, mints company inventory, and places company bid/ask orders. Stooq CSV is attempted for delayed prices; cached fallback prices are labelled delayed when fetch is unavailable.
- DEX modelling decision: Tempo's DEX tick range rejects raw prices such as $254. The on-chain TIP-20 represents dollar exposure units at roughly 1 pathUSD/unit; Teampot converts exposure to displayed shares using delayed reference prices for holdings, average cost, current value and gain/loss.
- Pay-to-stocks: Sam defaults to 20% of payday into AAPL. Payday first lands salary in the personal account, then the personal account buys AAPL exposure on the DEX. Manual Buy/Sell uses the same DEX route from the Money home.
- Money UI: employee and contractor phone views now start from Money home with Total balance, Spend, Keep, Earning, Invest, and Recent activity. Copy avoids crypto vocabulary; stocks show as `AAPL (test)` etc.
- Earn: implemented as a clearly labelled simulated Earning card/route. The attempted real path is blocked because this app has no public pathUSD ERC-4626 venue/factory configuration on Moderato; no real Earn deposit tx is claimed.

## Pass 6A Gate Results
- G1 Typecheck: PASS, `npm run typecheck`.
- G2 Unit tests: PASS, `npm test` (4 files, 23 tests, including stock math).
- G3 Build: PASS, `npm run build`.
- G4 E2E: PASS, `BASE=http://localhost:8790 npm run e2e`; includes AAPL setup ready, 20% payday buy tx `0x81a624c61be412406c0651e3530597e113f76789387354f908742d4e7273840a`, manual sell tx `0x17d0ddab819d5ae1f44aaea4861f2cf77dcd83a9f5598b7cb7b3b2b3b36fdefa`, and simulated Earn assertion.
- G5 Auth/passkey: PASS, `BASE=http://localhost:8790 npm run e2e:passkey`.
- G6 Banned words: PASS, `npm run check:banned`.
- G7 Responsive: PASS fallback, `BASE=http://localhost:8790 npm run responsive`; Chromium launch is still blocked by sandbox permissions, but the app loads.
- G8 Landing: PASS fallback, `BASE=http://localhost:8790 npm run landing`; Chromium launch is still blocked by sandbox permissions, but HTTP smoke for `/`, `/app`, invite route, manifest and OG asset passes.
- G9 Docs: PASS, HANDOFF and VERIFIED updated with pass 6A real-vs-simulated status.

## Pass 6A Known Gaps
- A non-restricted browser should still run the Playwright visual checks for the new Money home.
- Earning is simulated until there is a public pathUSD earning pool or a fully configured app-deployed Earn stack.
- Real-world stock mainnet path needs live tokenized stock issuers on or bridged to Tempo; pass 6A uses clearly labelled test assets only.
