# Teampot

**Live demo: https://teampot.vercel.app** (Tempo Moderato testnet, test money)

Work money, finally fun. Teampot runs payday, team pots, perks, kudos from savings, and contractor pay for everyone a company works with.

## Features
- Finance dashboard: payday preview/confirm, next payday date, history, team pot management, people management, vendor management, CSV export, receipt detail sheet.
- Team pots: per-person monthly limits and approved vendor lists enforced by Tempo access keys. Off-list or over-limit payments are held for a lead.
- Approve and add: a lead can pay a held vendor now and add it to the team list; demo keys rotate and team cards are re-issued.
- Perks: per-person allowances such as Lunch and Learning, each issued as its own access key with its own limit and vendor list.
- Quarter close: computes real remaining limits, pays a kudos pool from savings, records a leaderboard, and lets teammates award kudos.
- Contractor portal: invoice list, paid-in-seconds badge, and decline-with-reason.
- Face ID: browser passkeys become a person's spending key; the server records only verified receipts.
- Earned while unspent: shown only as a clearly labelled simulated card.

## Run Locally
1. `cp .env.example .env` and set `OPERATOR_PK` to a funded Moderato testnet key.
2. `npm install && (cd web && npm install)`
3. `npm run build`
4. `PORT=8790 npx tsx server/local.ts`
5. Open `http://localhost:8790`.

Use **View as** to switch between Finance (Jordan), a team lead (Ava), an employee (Sam), and a contractor (Mateo). Click **Set up team pots** once after a reset.

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
```

`npm run responsive` uses Playwright when it is installed. Without Playwright, it loads the local app and records the manual fallback in `GATES.md`.

## Deploy
Deployment is handled separately by the owner. Do not deploy from this workspace. Required production env vars remain `OPERATOR_PK`, `RESET_TOKEN`, and optionally `BLOB_READ_WRITE_TOKEN` for Vercel Blob state.

## What Is Real
See [VERIFIED.md](VERIFIED.md). Payday, contractor payments, pot spends, perks, approve-and-add re-issues, quarter close pool payments, kudos awards, and Face ID receipt verification have Moderato evidence. Earned while unspent is simulated.
