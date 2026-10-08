# Teampot

**Live demo: https://teampot.vercel.app** (Tempo testnet, test money)

Work money, finally fun. Payday, team pots and contractor pay for everyone a company works with, on Tempo.

## Run (Tempo testnet)
1. `cp .env.example .env` and set `OPERATOR_PK` to a funded Moderato testnet key (fund with `cast rpc tempo_fundAddress <addr> --rpc-url https://rpc.moderato.tempo.xyz`).
2. `npm install && (cd web && npm install)`
3. `npm run build` then `npm start` → http://localhost:8787 (API + web on one origin).
   For UI work: `npm run dev` (API) and `cd web && npm run dev` (http://localhost:5280, proxies /api).
5. Click **Set up team pots** once (issues each person's spending key on-chain).

Use **View as** to switch between Finance (Jordan), a team lead (Ava), an employee (Sam) and a contractor (Mateo).

## What is real on-chain
See [VERIFIED.md](VERIFIED.md). Payday is one atomic batch; each person's team-pot limit and approved-vendor list are enforced by a Tempo access key; off-list or over-limit payments are rejected by the chain and wait for the lead; approvals and contractor invoices are paid by the company with memos. Every receipt links to the public explorer.

## Demo-mode notes
- **Face ID:** tap "Turn on" in an employee wallet to create a device passkey. The company authorizes its public key as that person's spending key (same monthly cap + vendor list) and revokes the demo key; every payment is then signed on the device. Until someone turns it on, payments use a demo key derived from the server secret.
- Anyone can switch roles with **View as** — it's a demo of four people's screens, not an auth system.
- State lives in Vercel Blob (versioned files) when deployed, a local JSON file otherwise. Requests are serialized per instance; heavy concurrent use across instances could lose an update.
- Not built yet: earning on idle balances (no public testnet Earn vault), private payroll (Zones are early testnet).

`npm run e2e` style check: `node scripts/e2e.mjs` (needs the API running and setup done).

## Deploy (Vercel)
`vercel link`, `vercel blob create-store teampot-state --access public --yes`, set `OPERATOR_PK` (funded testnet key) and `RESET_TOKEN`, then `vercel deploy --prod`. Reset the demo: `BASE=https://… RESET_TOKEN=… sh scripts/demo-reset.sh`.
