# Teampot

**Live demo: https://teampot.vercel.app/app** (Tempo Moderato testnet, test money)

Every team runs its own money. Teampot runs payday, funded department accounts, perks, kudos from savings, and contractor pay for everyone a company works with.

## Features
- Finance dashboard: org map, department funding/returns, payday preview/confirm, next payday date, history, people management, vendor management, CSV export, receipt detail sheet.
- Sign-in: public Demo mode is visible; real users sign in with Face ID / Touch ID passkeys and receive an HTTP-only session cookie.
- Invites: Finance or a department head sends a one-time link; the new person sets up Face ID and lands in their department wallet.
- Departments: Finance funds each department account. Department roots issue per-person limits and approved vendor lists enforced by Tempo access keys.
- Finance rule: payments over the company threshold become Finance-only decisions.
- Approve and add: a lead can pay a held vendor from the department account and add it to the department list; demo keys rotate and department cards are re-issued.
- Perks: per-person allowances such as Lunch and Learning, each issued from the person's department account as its own access key.
- Quarter close: computes real remaining limits, pays a kudos pool from the department account, records a leaderboard, and lets teammates award kudos.
- Contractor portal: invoice list, paid-in-seconds badge, and decline-with-reason.
- Face ID: browser passkeys become a person's spending key; the server records only verified receipts.
- Mobile app shell: installable PWA manifest, cached first paint, and an offline page.
- Earned while unspent: shown only as a clearly labelled simulated card.

## Run Locally
1. `cp .env.example .env` and set `OPERATOR_PK` to a funded Moderato testnet key.
2. `npm install && (cd web && npm install)`
3. `npm run build`
4. `PORT=8790 npx tsx server/local.ts`
5. Open `http://localhost:8790` for the landing page or `http://localhost:8790/app` for the live demo.

Use the visible **Demo mode** switcher inside `/app` to move between Finance (Jordan), a department head (Ava), an employee (Sam), and a contractor (Mateo). Click **Fund departments** once after a reset. Invite links open under `/app/invite/:token`. The setup API also accepts a fresh-company payload with `companyName`, `departments`, and `invites` for non-demo starts.

## Test
From `app/`:

```bash
npm run typecheck
npm test
npm run build
BASE=http://localhost:8790 npm run e2e
BASE=http://localhost:8790 npm run e2e:passkey
npm run check:banned
BASE=http://localhost:8790 npm run responsive
BASE=http://localhost:8790 npm run landing
```

`npm run responsive` uses Playwright when it is installed. Without Playwright, it loads the local app and records the manual fallback in `GATES.md`.

## Deploy
Deployment is handled separately by the owner. Do not deploy from this workspace. Required production env vars remain `OPERATOR_PK`, `RESET_TOKEN`, and optionally `BLOB_READ_WRITE_TOKEN` for Vercel Blob state.

## What Is Real
See [VERIFIED.md](VERIFIED.md). Payday, department funding, department-issued spends/perks, approve-and-add re-issues, quarter close pool payments, kudos awards, department returns, contractor payments, and Face ID receipt verification have Moderato evidence. Earned while unspent is simulated.
