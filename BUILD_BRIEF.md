# Teampot — build brief for Codex (production build-out)

You are building Teampot from a verified P0 into a complete, production-ready product. Read this whole file, then `PRD.md`, `app/README.md`, `app/VERIFIED.md`, and the code in `app/server/` and `app/web/src/` before changing anything.

## What Teampot is
"Work money, finally fun." Payday, team pots, perks and contractor pay for everyone a company works with, on the Tempo blockchain (Moderato testnet, chain 42431). People never see crypto: no wallets, addresses, gas, tokens, seed phrases or hashes in the UI.

## What already works (do not break it)
Verified on testnet and covered by `app/scripts/e2e.mjs` and `app/scripts/e2e-passkey.ts`:
- Payday: one atomic batch transaction paying all staff, each line with a memo (`server/tempo.ts#payday`).
- Team pots: each person spends through a Tempo access key issued by the company account with a per-period cap AND a vendor allowlist (`scopes.recipients` on `transfer` and `transferWithMemo`). Both are enforced by the chain.
- Chain rejection → "Held for approval" → lead approves (company pays directly, counted against the pot app-side) or returns.
- Contractor invoices → approve & pay.
- Face ID: browser passkey becomes the person's spending key (authorized from its public key, `type: 'webAuthn'`); device signs; server re-verifies receipt (success, from company, exact recipient + amount, no replay).
- Storage: Vercel Blob versioned files when `BLOB_READ_WRITE_TOKEN` is set, else `data/state.json`. Requests serialized. State holds no secrets (demo keys derived from `OPERATOR_PK` + epoch).

Hard facts learned on testnet (respect them):
- Access keys cannot authorize other keys (no sub-delegation). The company root account issues every key.
- An access-key spend executes as the company account, so `feePayer: company` fails ("fee payer cannot resolve to sender"). The company already pays the fee. Fees count against the key's limit (tiny).
- Read remaining limit for a passkey key with `Address.fromPublicKey(PublicKey.fromHex(pub))`.
- No public Tempo Earn vault on testnet; Zones are early testnet. Anything relying on them must be clearly labelled "Simulated" in the UI and docs, or not built.
- Vercel Node functions need named `GET`/`POST` exports from `hono/vercel`.

## Build this

### Product features
1. **Admin management (Finance view)**
   - Create and edit team pots: name, colour, per-person monthly limit, approved vendors.
   - Add and edit people (employee/lead/contractor), titles, salaries, team.
   - Any change that affects a person's limit or vendor list must re-issue their key on-chain (revoke + authorize new), and the UI must say so ("Updating Sam's card…").
   - Add vendors.
2. **"Approve and add to list"** on held payments. Pays now, and adds the vendor to the pot so it isn't held next time (re-issue the team's keys). Investigate whether re-authorizing an existing passkey public key with new scopes works. If it doesn't, ask the person to re-confirm Face ID and record that in VERIFIED.md.
3. **Perks** (PRD F5). Per-person allowances such as "Lunch $15/day at Uber Eats" or "Learning $1,500/yr at Udemy", each as its own access key with a periodic limit and vendor scope. They show in the employee wallet as separate cards, and spending picks the right key. They must be chain-enforced, like pots.
4. **Quarter close and kudos from savings** (PRD F6).
   - Finance can "Close the quarter" for a pot. It computes unspent budget (real remaining limits) and shows a summary.
   - The company pays a kudos pool, a configurable share of savings (default 20%), split across teammates in one batch transaction with memos.
   - Teammates can award kudos to each other from their share (UI plus a real payment).
   - A leaderboard shows which team saved the most.
5. **Payday upgrades.** Payday history, a per-person payslip view (gross, date, receipt), a "next payday" date setting, and a preview/confirm step before paying.
6. **Receipts.** A receipt detail sheet: what, who, when, which pot, memo decoded, and a "View public record" link. Plus CSV export of activity for accounting.
7. **Contractor portal polish.** Invoice list with statuses, a "paid in X s" badge, and a decline-with-reason flow.
8. **Earning while unspent.** Show it only as a clearly labelled "Simulated" card with an explanation, or leave it out. Never present it as real.

### Design (make it fun, not corporate)
Follow PRD §9 (brand v2) and `brand/` for direction. The current palette is Clay `#E8552D`, Ink `#141414`, Paper `#F6F4F0`, Sand `#F1E4D8`, Clay Deep `#B8401C`, plus Butter `#F6E6A5` and Sage `#C8D69B` from v2.
- **Mascot.** Create the Teampot mascot as inline SVG React components: a round clay pot with a face, a coin hat, little feet. Give it states: idle, cheering (payday), holding a receipt, guarding (held for approval), napping (nothing waiting), celebrating (quarter close). Use them in empty states, toasts and success moments, and keep them tasteful.
- **Type.** Inter Tight is in use. Headlines and money figures in ExtraBold Italic are the brand voice.
- **Motion.** Subtle, GPU-friendly (transform/opacity only), and respect `prefers-reduced-motion`.
- **States.** Every screen needs loading skeletons (no blank "Loading…"), empty states, error states with retry, and disabled/pending button states.
- **Responsive.** Works at 375 px with no horizontal scroll; the desktop Finance view uses the space.
- **Accessibility.** Keyboard navigable, visible focus, labelled controls, AA contrast (small clay text uses Clay Deep), and `aria-live` for toasts.
- **Copy.** Warm, short, a little cheeky ("Payday's in the pot."). The banned-words list in PRD §8 is absolute for UI text.

### Production readiness
- **Validation.** Validate every API input (zod or hand-rolled) and return 4xx with friendly messages for bad input. Unknown ids → 404, not crashes.
- **Speed.** `/api/state` must be fast: run chain reads in parallel and add a short in-memory cache (≈5 s) for balances and limits, invalidated on writes. First paint shows skeletons, not "Loading…".
- **Idempotency.** Double-clicking Approve, Pay or Run payday must not pay twice (server-side guards keyed by request id or state check).
- **Tests.** Unit tests (vitest) for server logic with the chain layer mocked: pot math, held reasons, quarter-close split, validation, idempotency, verifySpend parsing. Keep and extend `scripts/e2e.mjs` and `scripts/e2e-passkey.ts` for the new features (perks, add-to-list, quarter close) against a local server on testnet.
- **Scripts.** `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` all work from `app/`.
- **Docs.** Update `app/README.md` (features, run, test, deploy) and `app/VERIFIED.md` (every new on-chain claim with evidence, and anything that turned out not to work).

## Rules
- Testnet only. Use `app/.env` `OPERATOR_PK` for local runs. **Never read, print, copy or modify `app/.env.deploy`, `app/.env.local` or `app/.vercel/`. Never run `vercel` or deploy.** I (Claude) deploy after review.
- Never commit secrets. Keep `.gitignore` intact.
- Do not change git remotes or push. Commit your work on the current branch (`codex/build-out`) in logical commits. Commit messages must NOT include any Co-Authored-By or AI attribution lines.
- Don't claim anything is on-chain unless a test or a transaction proves it. If a Tempo feature doesn't work, say so in VERIFIED.md and design around it honestly.
- Keep the code idiomatic with what's there: TypeScript, Hono, React 19, Vite, plain CSS (CSS modules or one stylesheet are fine; no heavy UI framework needed).
- Write the acceptance gates in `app/GATES.md` (see below), run them, and only finish when they all pass. Report any gate you could not satisfy and why.

## Acceptance gates (put these in app/GATES.md and make them pass)
- **G1 Typecheck:** `npm run typecheck` (server + web) exits 0.
- **G2 Unit tests:** `npm test` passes, with at least 25 meaningful assertions across pot math, quarter close, validation, idempotency and verifySpend.
- **G3 Build:** `npm run build` exits 0.
- **G4 E2E:** with the local server running and setup done, `npm run e2e` passes all flows. That's the old ones plus perks, approve-and-add-to-list, quarter close/kudos, and contractor decline, against Moderato.
- **G5 Banned words:** a script greps `web/src` for user-visible banned words (wallet, gas, token, blockchain, chain, stablecoin, seed phrase, private key, address, tx hash) and passes. Code identifiers and comments are excluded; check rendered strings.
- **G6 Secrets:** `git log -p` on your branch contains no private keys, blob tokens or reset tokens.
- **G7 Responsive:** a Playwright or puppeteer script (if available; otherwise document a manual check) loads each of the 4 views at 375 px and 1280 px with no horizontal overflow and no console errors.

When done, write `app/HANDOFF.md`: what you built, what's real on-chain vs simulated, gate results, known gaps.
