# Teampot

Work money, finally fun. Payday, team pots and contractor pay for everyone a company works with, on Tempo.

## Run (Tempo testnet)
1. `cp .env.example .env` and set `OPERATOR_PK` to a funded Moderato testnet key (fund with `cast rpc tempo_fundAddress <addr> --rpc-url https://rpc.moderato.tempo.xyz`).
2. `npm install && (cd web && npm install)`
3. API: `npx tsx server/index.ts` (port 8787)
4. Web: `cd web && npm run dev` → http://localhost:5280
5. Click **Set up team pots** once (issues each person's spending key on-chain).

Use **View as** to switch between Finance (Jordan), a team lead (Ava), an employee (Sam) and a contractor (Mateo).

## What is real on-chain
See [VERIFIED.md](VERIFIED.md). Payday is one atomic batch; each person's team-pot limit and approved-vendor list are enforced by a Tempo access key; off-list or over-limit payments are rejected by the chain and wait for the lead; approvals and contractor invoices are paid by the company with memos. Every receipt links to the public explorer.

## Demo-mode notes
- Employee "Face ID" confirm is a UI step; spending keys are held by the demo server. Browser passkeys (`Account.fromWebAuthnP256`) are next.
- Not built yet: earning on idle balances (no public testnet Earn vault), private payroll (Zones are early testnet).

`npm run e2e` style check: `node scripts/e2e.mjs` (needs the API running and setup done).
