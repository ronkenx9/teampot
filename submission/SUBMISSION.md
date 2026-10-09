# Teampot: Colosseum Crypto World's Fair, Tempo track

> Draft. Fields marked **[OWNER]** need your input; nothing there is invented. Deadline: **Oct 12, 2026, 11:59 pm PDT**.

## Product name
Teampot

## One-liner
Every team runs its own money.

## Description (short)
In most companies every money decision (a new tool, a vendor, a perk, an over-budget expense) gets choked up to one finance desk. Teampot moves those decisions to where the work happens. Finance funds each department as its own account on Tempo. Department heads set their team's limits and approved vendors. Everyone gets paid and spends from their phone with Face ID, and the network enforces the rules, not a spreadsheet.

## Description (long)
**Who it's for:** companies of roughly 20–500 people with several departments and a small finance team. That's the size where "ask Finance" becomes the bottleneck, and where corporate cards and spend tools still route every exception back to one desk.

**How it works**
1. **Finance sets the frame.** It funds each department (a real Tempo account) with its budget, runs payday for everyone in one transaction, and sees everything live.
2. **Departments decide.** Each head issues their team's spending keys: monthly limits, approved vendors and perks, all enforced on-chain. A payment outside the rules is stopped by the network and waits for the head's one-tap decision, never for a ticket queue. Nobody approves their own request; payments over a company threshold go to Finance.
3. **Everyone uses their phone.** An invite link, then Face ID, and you're in. No cards to issue, no expense reports, no gas or crypto vocabulary. Contractors get paid the moment their invoice is approved.

**What's real today** (Tempo Moderato testnet, all evidenced in app/VERIFIED.md):
- Department accounts funded by Finance, issuing their members' access keys with periodic caps and recipient allowlists.
- Chain-enforced rejections becoming held decisions.
- One-transaction payday with per-line memos.
- Perks as separate capped keys.
- Passkey (WebAuthn) spending keys authorized from the public key, plus passkey sign-in with origin checks.
- One-time invite onboarding.
- Quarter close paying a kudos pool from savings.
- Contractor pay from the hiring department.
- Server re-verification of every device-signed payment.

**What's app-enforced or not built yet (honest list):**
- The company "over $X needs Finance" rule (no per-payment cap primitive found on Moderato).
- A department head's Face ID becoming the department root (needs Tempo admin keys, T6).
- Earning on idle balances (shown as Simulated; no public testnet vault).
- Private payroll via Zones.

## Blockchains and tools
Tempo (Moderato testnet, chain 42431), via viem `viem/tempo`:
- access keys with periodic limits and recipient scopes
- TIP-20 transfers with memos
- batch transactions
- WebAuthn (passkey) keys
- fee payment in stablecoins

Also: Hono API on Vercel, React 19 + Vite PWA, Vercel Blob, Playwright and Vitest.

## Links
- Live demo: https://teampot.vercel.app
- GitHub: https://github.com/ronkenx9/teampot (MIT)
- Verified on-chain claims: https://github.com/ronkenx9/teampot/blob/main/app/VERIFIED.md
- Pitch video: **[OWNER: YouTube/Loom link]**
- Technical demo video: **[OWNER: link]**

## Logo
brand/logo-v4/final/teampot-logo.svg (symbol: brand/logo-v4/final/teampot-symbol.svg)

## Team
**[OWNER]** Names, roles, backgrounds. Colosseum weights founder–market fit heavily, so say why you understand this problem (for example, ops/finance experience, or having lived the "ask Finance" bottleneck).

## Location
**[OWNER]**

## Market
- Spend management is one of fintech's largest categories. Ramp reported a $44B valuation in 2026, and Brex was acquired by Capital One for $5.15B. Both run on card rails, with central finance as the decision point.
- Teampot's wedge is decentralised decision rights plus instant settlement: every team runs its own account, and the network, not a policy PDF, enforces the rules. That is only practical on a payments chain with stablecoin fees, programmable access keys and sub-second settlement, which is Tempo.

## Demand validation
**[OWNER]** Talk to 3–5 people who run finance or ops at 20–500-person companies before submitting, and record one quote each (even informal; the Colosseum workshop explicitly values this). Suggested questions:
1. How many spend requests hit your desk in a week?
2. Which ones should the team have decided themselves?
3. Would you let department heads hold their own budget if limits were enforced automatically?

## Go-to-market
1. **Wedge:** startups and agencies already paying contractors abroad in stablecoins (fast payouts, no FX loss). The contractor flow is the first hook.
2. **Expansion:** once one department runs on Teampot, Finance funds the others. Every invite is a new user with zero onboarding.
3. **Distribution:** Tempo's partner network (payroll and contractor platforms already on Tempo), fintech/ops communities, and building in public on X with live testnet receipts.
4. **Revenue:** per-active-member SaaS pricing plus a small fee on payday and contractor payouts.

## What's next
Mainnet with a GENIUS-compliant stablecoin (OUSD), card issuing through a Tempo card partner for merchants that don't accept stablecoins yet, admin-key rotation so heads fully own their department root (T6), Earn on idle department balances, and private payroll via Zones.
