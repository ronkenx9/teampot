# Teampot v3: "Every team runs its own money" (Codex brief)

Read BUILD_BRIEF.md first. Its rules still apply in full: testnet only, never touch app/.env.deploy, app/.env.local or app/.vercel, never deploy or push, no AI attribution in commits, never claim on-chain behaviour without a test or tx. Git is read-only in your sandbox, so leave changes uncommitted. Use PORT=8790.

Then read PRD.md, app/HANDOFF.md, app/VERIFIED.md and the current code.

## The new product idea (this replaces the "fun" framing)
- **Pitch:** "Every team runs its own money."
- **Supporting line:** "Finance sets the frame. Departments decide. Everyone's paid and spends from their phone, with limits the network enforces."
- **The problem:** in most companies, every money decision (a new tool, a vendor, a perk, an over-budget expense) gets choked up to one admin/finance desk. Teampot moves decisions to where the work happens. Each department owns its budget and its rules, and Finance keeps the frame and full visibility.
- **Audience:** everyone in the company. It must be instantly understandable to a new employee on their phone, with zero onboarding.

## 1. Department accounts (core architecture change; prove it first)
On Tempo, a spending (access) key cannot authorize other keys. Only an account's root can. So real delegation means **each department gets its own Tempo account whose root is controlled by the department head.**
- **Funding:** Finance (the company account) funds each department account with its budget (a real transfer, with a memo).
- **Team keys:** the head (department account root) issues their team members' spending keys (caps, vendor allowlists, perks) directly on-chain, signed by the department root, not the company.
- **Root key:** for the seeded demo, the department root is a server-held P256 key derived from the server secret (labelled demo, like today). Investigate and implement letting the head "take over with Face ID": the head's passkey becomes the department's root, by creating the department account from the head's passkey at setup or by any mechanism Tempo actually supports on Moderato (hardfork t5; admin keys need T6, so check). If true takeover isn't possible on t5, implement the closest honest version and document exactly what is and isn't real in VERIFIED.md.
- **Finance's frame** = the money it funds (a department cannot spend more than it holds; the chain enforces this) plus optional company-wide rules (for example, "single payments over $X need Finance"), enforced where you honestly can. Say in VERIFIED.md which rules are chain-enforced and which are app-enforced.
- **Unspent budget:** the head can "Return to company" (a real transfer). Quarter close and kudos now run from the department account.
- **Payday** stays with Finance (company account → everyone).
- **Prove it first.** Write `scripts/probe-dept.ts` before refactoring: company funds a dept account, the dept root issues a member key with cap + vendor scope, the member spends OK, an off-list spend is rejected, and the dept returns funds. Record the txs in VERIFIED.md. If something fails, adapt the design and say so.

## 2. Org map (the main screen)
- The home screen is a visual, zoomable/tappable map of the company: Company → departments → teams → people.
- Each node shows its money with the block mark ("Fill": a 4×4 grid of rounded blocks; lit blocks = share left, filling from the bottom). See brand/generative/index.html for the drawing function and reuse that logic as a React/SVG component.
- Tapping a department opens its space: budget, people, rules (limits, vendors, perks), pending decisions and activity.
- Finance sees the whole map. A department head sees the company map read-only, with full control of their own department. Employees and contractors land straight on their own phone view; no map is needed.
- Moving money (Finance → department, department → person card) should feel direct, for example dragging a block or a clear "Fund Design" action. Every action shows its receipt.

## 3. Design
- **Remove the mascot entirely** (components, CSS, copy).
- **Calm, premium, mobile-first:**
  - big money numbers in Inter Tight ExtraBold Italic
  - one primary action per screen
  - bottom sheet patterns on mobile
  - fast perceived performance (skeletons, optimistic updates where safe)
- **Palette:** Clay #E8552D (accent only), Ink #141414, Paper #F6F4F0, plus neutrals. No Butter or Sage blocks.
- **Motion** only for feedback: a block lighting up when money lands, or a node pulsing when a decision is waiting. Transform/opacity only, and respect reduced motion.
- **Copy:** grown-up and short. Avoid "fun", "magic", "seamless", "empower", "unlock", "supercharge". The banned UI words from PRD §8 still apply.
- Keep accessibility (AA contrast, focus, labels) and no horizontal scroll at 375px.

## 4. Keep working
Everything currently verified must keep working or be migrated to the department model:
- payday
- held for approval (the decider is now the department head; Finance can override; nobody approves their own request)
- approve + add
- perks
- contractor invoices (paid from the department that hired them, or from the company)
- Face ID spending
- receipts and CSV
- viewer-scoped privacy

## Gates
- All existing gates in app/GATES.md must pass, updated for the new model.
- Add **G8 Department delegation** e2e: Finance funds Design; the Design root issues Sam's key; Sam spends OK; an off-list spend is held; Ava (head) approves from the department account; Ava cannot approve her own request; Design returns unspent money. All of it real on Moderato.

Finish with app/HANDOFF.md ("v3" section) and a summary of what's real vs app-enforced.
