# Teampot app

Server, web app and website for Teampot. Overview and screenshots: [../README.md](../README.md). Permission model: [../ARCHITECTURE.md](../ARCHITECTURE.md). Evidence: [VERIFIED.md](VERIFIED.md).

Live: https://teampot.vercel.app (`/` website, `/app` app, `/tour` guided tour). Tempo Moderato testnet, test money.

## Features

**Finance (Jordan)**
- Company treasury, payday review and confirm (one batch payment with memos), payday history.
- Departments: each a Tempo account. Add money or pull it back (real transfers), appoint or change the head (admin access key), see every card with who signed it and its public record.
- Top-up requests from heads, Finance-limit approvals, contractor invoices, people and salaries, vendors, CSV export.

**Department head (Ava)**
- Holds an admin key on the department account (TIP-1049).
- Signs the team's cards (monthly limit and vendor list), approves held payments with the head key ("Approve + add" puts the vendor on every card), pays team contractors, asks Finance for more budget, invites employees and contractors.

**Employee (Sam)**
- Money home: total, cash, invested, card left; the card signed by the head.
- Pay with the card (vendor chips, Face ID); off-card payments are refused by Tempo and become a request to the head.
- Invest: buy and sell test stock tokens on Tempo's stablecoin exchange, or send a share of every payday automatically.
- Perks (e.g. Lunch, Learning) as separate cards. Earning is labelled Simulated.

**New: agents, sending money, Visa card, idle budgets**
- Agent cards: a head gives an AI agent its own card (limit and vendors, signed by the head key); the agent pays via `POST /api/agent/pay` with its agent key.
- Send your own money by @username, to a saved payee, or to a new Tempo account (saved on request).
- Visa card: simulated issuer today; "Tap at a shop" checks the Tempo card and settles on Tempo. Plug in Stripe Issuing per `../ISSUING.md`.
- Idle budgets earn: simulated on testnet; real Tempo Earn with `TEMPO_EARN_VAULT`.
- Close the quarter (kudos from savings) and send kudos.

**Contractor (Mateo)**
- Send invoices, see paid-in-seconds and declined-with-reason.

**Everyone**
- Face ID passkeys as card keys; invite links set up Face ID on the person's own phone.
- Every action links to its record on the Tempo explorer. No tokens, chains or addresses in the UI (`npm run check:banned`).

## Run locally

```bash
cp .env.example .env            # OPERATOR_PK = a funded Moderato testnet key
npm install && (cd web && npm install)
npm run build
PORT=8790 npx tsx server/local.ts
```

Open `http://localhost:8790`. The first visit to `/app` shows "Try the demo"; pick a person. To start over: `POST /api/reset` (send `x-reset-token` if `RESET_TOKEN` is set), then `POST /api/setup`.

Low on test money? Moderato's faucet RPC tops up an address:

```bash
curl -s -X POST https://rpc.moderato.tempo.xyz -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tempo_fundAddress","params":["0xYOUR_ADDRESS"]}'
```

## Environment

| Variable | Use |
|---|---|
| `OPERATOR_PK` | Testnet key for the company treasury. Department and demo keys are derived from it. Never commit it. |
| `RESET_TOKEN` | Required header for `/api/reset` in production |
| `SESSION_SECRET` | Signs session cookies (falls back to a hash of `OPERATOR_PK`) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | Upstash Redis state with atomic writes. Without them, state lives in memory and `data/state.json`. |
| `DEMO_MODE=off` | Turns off demo sign-in |
| `TEMPO_NETWORK`, `TEMPO_EARN_VAULT`, `TEMPO_RPC`, `TEMPO_EXPLORER` | Mainnet and real Tempo Earn (see `../ISSUING.md`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ISSUING_SETTLEMENT_ACCOUNT`, `ISSUING_BILLING_ADDRESS` | Live Visa cards through Stripe Issuing (see `../ISSUING.md`) |

## Test

```bash
npm run typecheck
npm test                                     # unit tests, chain layer mocked
BASE=http://localhost:8790 npm run e2e       # every flow against Moderato
BASE=http://localhost:8790 npm run e2e:passkey
BASE=http://localhost:8790 npm run journey   # Sam is held, Ava approves (browser)
BASE=http://localhost:8790 npm run responsive  # every role, every tab, 375px and 1280px
BASE=http://localhost:8790 npm run landing
npm run check:banned
BASE=http://localhost:8790 npm run audit     # 40-step UI audit, every role, real testnet
npx tsx scripts/probe-admin-key.ts           # head admin key delegation probe
```

Browser checks need Playwright's Chromium: `PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright npx playwright install chromium`.

## Deploy

Vercel project rooted at `app/` (`vercel.json`: Hono API at `/api`, the Vite build for everything else, fluid compute). Set the environment variables above, then `vercel deploy --prod`.

## Layout

```
server/   app.ts (API + permission rules), tempo.ts (Tempo calls), domain.ts (pure logic), store.ts (Redis/memory)
web/src/  App.tsx (app), glide.tsx (UI primitives), Landing.tsx (website), Tour.tsx (guided tour)
scripts/  e2e, passkey e2e, journey, responsive, landing, banned-words, admin-key probe
```
