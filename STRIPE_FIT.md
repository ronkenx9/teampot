# Teampot and the Stripe stablecoin stack

Source: "A guide to Stripe's stablecoin stack" (@StripeCrypto, 2026-09-29). Also tempo.xyz, which quotes Patrick Collison: "Tempo is now Stripe's default blockchain for new features."

## The one-line fit

> Stripe gives companies stablecoin treasury, cards and payouts. Teampot is how everyone inside the company actually uses them: every team, every card, every payday, on Tempo.

Stripe sells the building blocks to the company (Treasury, Issuing, Global Payouts, Onramp, Bridge, Privy). Teampot is the app the company's people live in.

## The Teampot account: a wallet and a card

Every person who joins gets:

1. **A wallet** (their Tempo account). Pay lands there, shown in dollars. They spend, hold or invest from it without cashing out. Built today.
2. **A card.** Today it is a Tempo access key: signed by the department head, with a monthly limit and approved vendors, and Tempo enforces it. In production it also becomes a **Visa card issued through Stripe Issuing**, backed by the department's balance on Tempo. Stripe Issuing already supports stablecoin-backed cards, and Tempo is Stripe's default chain, so this is the natural production path. It is not built.

This fills the "company card" slot in the app: one card, the same rules, whether the vendor takes payment on Tempo or only takes Visa.

## Mechanics worth building

| # | Mechanic | How it works | Status |
|---|---|---|---|
| 1 | **One card, two rails, one rule set** | A vendor on Tempo is paid directly with the card key. Anywhere else, the Visa card is used, and Stripe Issuing's real-time authorization asks Teampot. Teampot checks the same Tempo card (`getRemainingLimit` plus the vendor list) and approves or declines. Settlement debits the department account on Tempo. | Roadmap |
| 2 | **Vendor list ↔ merchant categories** | The card's approved vendors map to Visa merchant categories, so "Software" and "Meals" work at the checkout the same way they do on Tempo. | Roadmap |
| 3 | **A decline becomes a request** | A Visa decline at checkout pushes an "approve once" request to the head, exactly like a held payment today. Once approved, the retry goes through. | Held → approve flow built; Visa side is roadmap |
| 4 | **Two cards in the wallet** | "Design card" (company money, head's rules) and "Your card" (your own pay). One app for both. | Team card built; personal card is roadmap |
| 5 | **Agent cards** | A head issues a card to an AI agent (e.g. a Design bot buying fonts and stock photos) with the same Tempo-enforced limit and vendors. It matches Stripe's "issuing for agents" and Tempo's agent-payments push. | Can be built now (same access-key path as people) |
| 6 | **Global contractor payouts** | Contractors in any country are paid in seconds, in dollars, with no currency fee. Stripe cites Remote paying contractors in USDC across 60+ countries, 2–3 days faster, avoiding over 1% in currency fees. Cash-out to a local bank via Bridge. | Payouts built on Tempo; Bridge cash-out is roadmap |
| 7 | **Fund the treasury from a bank or card** | Finance tops up the company treasury through Stripe's Crypto Onramp. | Roadmap |
| 8 | **Pay by email** | Invite and pay a contractor with just their email (Stripe Treasury pays anyone in 160 countries by email). | Roadmap (we use invite links) |
| 9 | **Idle budgets earn** | Unspent department money earns until it is spent (Stripe Treasury credits on balances; Ramp "hold, move and earn"). | Shown as "Simulated" until Tempo has a testnet vault |
| 10 | **Everything in dollars** | Like Ramp's Stablecoin Accounts: no tokens, chains or addresses in the UI. | Built (enforced by `npm run check:banned`) |

## For the pitch and submission

- Lead line: the one above.
- Contractor proof point: Stripe's Remote numbers (cite Stripe), shown with Mateo (Mexico) and Yuki (Japan).
- Roadmap slide: rows 1–4 (the Teampot account: wallet + Visa card through Stripe Issuing, one rule set), then 6–9.
- Honesty: today's cards are Tempo keys only; the Visa card, onramp, Bridge cash-out and earning are roadmap.

## Before Oct 12 (optional)

- Agent cards (row 5): about 2 hours, reusing the existing card setup.
- Copy: the lead line on the landing page, a short "Where Teampot fits" section, and the contractor framing.
