# Teampot — PRD v1

> Status: draft · 2026-10-08 · Target: Colosseum Crypto World's Fair, **Tempo track** (submissions due 2026-10-12)
> Owner: Kenn Ronin · Brand: Teampot (T-Pot mark, Clay #E8552D)

## 1. One line
**Work money, finally fun.** Pay, perks and team pots for everyone a company works with (employees and contractors alike), built on Tempo and made for people who will never know it's crypto.

## 2. Problem
Internal company money is a chore for everyone involved:
- **Employees** front costs and wait weeks for reimbursement, file expense reports, and wait 2–3 days for payroll to land.
- **Contractors** invoice, then wait 30–60 days, and lose 1–4% to FX on cross-border pay.
- **Team leads** chase approvals, track budgets in spreadsheets, and burn leftover budget at quarter end because unspent money gets clawed back.
- **Finance/ops** reconcile vague bank transfers against invoices by hand and pre-fund cards that sit idle.

Existing tools (Ramp, Brex, Deel, Gusto) solve pieces on card and bank rails. They're built for the finance team, not for the people being paid, and none of them make it feel good.

## 3. Users
| User | Job to be done | What "fun" means for them |
|---|---|---|
| Employee | Get paid, spend perks, never front money | Payday that lands in a second, perks that just work with Face ID |
| Contractor | Get paid the moment work is approved | A pay link, money in seconds, choose bank or keep it earning |
| Team lead | Run a team pot without spreadsheets | A live pot, one-tap approvals, the team keeps a share of what it saves |
| Finance admin | One place for payroll, contractors, budgets | Fewer exceptions, idle money earning, audit trail by default |

## 4. Goals and non-goals
**Goals (hackathon)**
1. A working end-to-end demo on Tempo testnet (Moderato, chain 42431) covering payday, contractor pay, and a team pot.
2. Zero crypto vocabulary in the UI (see §8).
3. Every Tempo claim in the pitch maps to a real testnet transaction or is labelled simulated.

**Non-goals (hackathon)**
- Real card issuing, real bank on/off-ramps, mainnet funds, KYC, multi-company tenancy, mobile native apps.

## 5. Features

### P0 — must ship
**F1. Payday**
- Admin uploads or edits a payroll list and taps **Run payday**.
- One scheduled batch transaction pays everyone; each person sees "Payday · $3,240 · landed in 0.4s".
- Payroll is private to company + employee (Tempo Zone if usable on testnet; otherwise labelled).

**F2. Contractor pay links**
- Each invoice gets its own **pay link** (Tempo virtual address); payment auto-matches to the invoice.
- Admin taps **Approve** → contractor is paid instantly with an invoice memo.
- Contractor view: "Paid · Invoice #0042 · $1,800" with **Send to bank** (simulated) or **Keep it earning**.

**F3. Team pots**
- Admin creates a pot per team ("Design · Q4 · $15,000, resets Jan 1"), implemented as a Tempo access key with a periodic cap on the company account. Money stays in the company account until spent.
- Team members spend with Face ID (passkeys); company sponsors all fees.
- Every payment carries a memo (category + receipt) — no expense reports.
- Payment to a vendor outside the pot's allow list is **Held for approval** (receive policy); lead taps Approve or Return.

**F4. Earning while unspent**
- Idle company balance earns via Tempo Earn; dashboard shows "Earned while unspent: $1,284".
- If Earn isn't available on testnet: simulated and labelled in the UI.

### P1 — ship if time allows
**F5. Perks** — per-person allowances ("Lunch $15/day", "Learning $1,500/yr") as periodic access keys.
**F6. Kudos from savings** — at quarter end, the yield plus a share of a pot's unspent budget goes to a team kudos pool that teammates award to each other (TIP-20 reward distribution).
**F7. Mascot moments** — the Teampot mascot reacts to events (payday, approval, savings milestone).

### P2 — pitch only
Real card issuing (Tempo card partners), bank on/off-ramps, Slack/Teams bot, multi-currency payroll via Tempo stablecoin DEX, accounting export.

## 6. Tempo primitives (hero map)
| Feature | Tempo primitive | Verified on testnet? |
|---|---|---|
| Payday | Batch + scheduled transactions (Tempo Transactions) | To verify Day 1 |
| Private payroll | Tempo Zones | To verify Day 1 |
| Pay links | Virtual addresses + TIP-20 memos | To verify Day 1 |
| Team pots | Access keys with periodic limits | To verify Day 1 (incl. sub-delegation) |
| Held for approval | TIP-403 policies + receive policies (recoverable holds) | Proven in STIPEND (2026-09-21) |
| Face ID, no fees | Passkey accounts + fee sponsorship | To verify Day 1 |
| Earning while unspent | Tempo Earn | To verify Day 1 |
| Kudos split | TIP-20 reward distribution | P1 |

**Why it needs Tempo:** without it, budgets-as-permissions with periodic resets, recoverable held payments, per-invoice addresses, private batch payroll and fee-free Face ID payments all have to be built by hand.

## 7. Demo (≤ 3 min, money shot in first 60s)
1. **Payday:** admin taps Run payday → 12 people paid in one tap, each phone pings "landed in 0.4s".
2. **Contractor:** invoice approved → contractor's pay link shows Paid instantly.
3. **Team pot:** designer buys a font license with Face ID → filed automatically. Then tries an unapproved vendor → **Held for approval** → lead taps Approve.
4. **Earning:** dashboard shows idle money earning while unspent.
5. **Close:** mascot + "Work money, finally fun." → pan to testnet receipts.

## 8. UX principles (non-crypto-native)
| Never show | Show instead |
|---|---|
| wallet, address, seed phrase | "Your Teampot account", sign in with email then Face ID |
| stablecoin, token, OUSD | dollars, "$" |
| gas, fees | nothing — company covers it |
| tx hash, block | **Receipt** (optional "proof" detail view) |
| virtual address | **Pay link** |
| receive policy / blocked balance | **Held for approval** · Approve / Return |
| access key, periodic cap | "Q4 pot: $15,000, resets Jan 1" |
| Earn, yield, APY | "Earned while unspent" |
| Zone | "Private payroll" |

## 9. Brand direction v2 (from So Matcha reference)
The v1 board was too corporate. v2 goes character-led and tactile:
- **Mascot:** the T-Pot becomes a character — a round clay pot with a face, coin-hat on top, little feet; expressive poses (payday cheer, holding a receipt, guarding the pot, napping when money is earning).
- **Logotype:** chunky, bubbly, tightly stacked lowercase "team / pot" with the mascot breaking into the letters, like the reference.
- **Marks:** primary (logotype + mascot), logotype, brandmark (mascot alone), submark ("tp" monogram).
- **Palette:** Clay #E8552D (signature), Butter #F6E6A5, Sage #C8D69B, Cream #FBFCEE, Ink Brown #2B1D14. Flat colour blocks with light grain.
- **Type:** chunky rounded display for logotype/headlines; Poppins/Comfortaa-style friendly sans for UI.
- **Applications:** office mug, tote, hoodie, laptop sticker sheet, Slack emoji pack, payday push notification, app icon, office wall sign.
- **Voice:** warm, short, a little cheeky. "Payday's in the pot." "Held for a sec — your lead's on it."

## 10. Success criteria (acceptance gates)
- [ ] Payday batch tx confirmed on Moderato; ≥ 10 recipients; receipt link resolves.
- [ ] Pay link payment auto-matched to the right invoice in the UI.
- [ ] Off-allow-list payment shows Held for approval and is recoverable on-chain.
- [ ] Face ID sign-in works in demo browser; no fee prompts shown.
- [ ] UI text grep finds zero banned words from §8.
- [ ] Every simulated piece carries a visible "simulated" label.
- [ ] Public repo with README run steps; demo video ≤ 3 min; submitted by owner before 2026-10-12.

## 11. Timeline (4 days)
| Day | Work |
|---|---|
| Oct 8 | Verify primitives (access keys + periodic limits + sub-delegation, virtual addresses, batch/scheduled, Zones, Earn, passkeys). Lock what's real vs simulated. |
| Oct 9 | P0 F1–F3 backend on testnet + minimal UI. |
| Oct 10 | UI polish with brand v2, F4, mascot states, P1 if ahead. |
| Oct 11 | Deploy, claims audit, record video. |
| Oct 12 | Buffer + owner submits. |

## 12. Risks and open questions
- Access-key sub-delegation (company → lead → employee) may not exist; fallback is app-enforced per-person limits on top of chain-enforced team caps (say so in the pitch).
- Zones / Earn may not be usable on testnet; label simulated.
- Trademark/domain for "Teampot" not checked.
- Reuse from STIPEND: Moderato funding, receive-policy firewall, viem/tempo client setup are already proven (`~/Documents/vibecoding/stipend/`).
