# Teampot web app redesign (Codex brief)

Rules from BUILD_BRIEF.md apply: testnet only; never touch app/.env.deploy, app/.env.local or app/.vercel; no deploy or push; no AI attribution; git is read-only in your sandbox. Use PORT=8790. Edit only inside app/web/ (and the server only if a screen genuinely needs a small new read endpoint).

## Why
The owner's verdict on the current UI: "boring, basic, cluttered, not intuitive, it doesn't explain anything." Every feature works (keep it all working: run the e2e suites); the experience doesn't. Redesign the web app (/app) mobile-first, in the spirit of Apple's Human Interface Guidelines. Read brand/DESIGN_SPEC.md and look at brand/references/*.png before starting.

## Apple guidance to apply (quoted from the HIG, fetched 2026-10-10)
- **Onboarding:** "people can understand your app simply by experiencing it." "Teach through interactivity." "Consider providing a collection of context-specific tips instead of a single onboarding flow… display these instructions near that area." Keep any intro "brief" and "optional", and don't show it again once skipped.
- **Layout:** "Order content by relative importance… place the most important items near the top." "Group related items." "Use progressive disclosure to make layouts cleaner." "Differentiate controls from content."
- **Tab bars:** "Use a tab bar to support navigation, not to provide actions." Keep it visible; few tabs; single-word labels; "If a section is empty, explain why."
- **Sheets:** for "a simple task that [people] can complete before returning". One sheet at a time, with Cancel/Done.
- **Motion:** "Add motion purposefully." "Aim for brevity and precision." Avoid motion on frequent interactions. Make it optional (reduced motion).
- **Typography:** few typefaces; hierarchy through weight, size and colour; no thin weights.

## The new experience

### 1. First screen (the demo's front door), at /app when there's no session
- Full-bleed black. Centre: the 3D chrome mark `/mark3d.webp` (already rendered; 1200×1200), large, with a slow and subtle float (reduced motion: static).
- Below: "Teampot" in white, then one line: "Every team runs its own money."
- One primary button, "Try the demo", and a quiet "Sign in with Face ID" link.
- "Try the demo" opens a sheet, **"Who do you want to be?"**, with 4 large role cards. Each card has an avatar, a name and title, and a one-line *what you'll do* in plain words:
  - Sam, Designer: "Spend from your team's budget and invest your pay."
  - Ava, Design lead: "Approve your team's requests and set its rules."
  - Jordan, Finance: "Fund departments and run payday."
  - Mateo, Contractor: "Send an invoice and get paid in seconds."
- Picking a role signs into demo mode and lands on that role's home.
- The role can be switched any time from the profile/avatar menu at the top. The current pill row of 4 names disappears from every screen.

### 2. Navigation
- **Phone:** a bottom tab bar, at most 4 single-word tabs, different per role:
  - Employee: Home · Spend · Invest · Activity
  - Lead: Home · Approvals · Team · Activity
  - Finance: Home · Payday · Teams · Activity
  - Contractor: Home · Invoices · Activity
- **Desktop (≥ 900 px):** the same items as a slim left sidebar. The content column is max 720 px on phone-style screens; Finance may use a 2-column layout on desktop.
- **Actions** (Pay, Approve, Run payday, Send invoice) are buttons on screens or sheets, never tabs.

### 3. Home screens: one job, top-down by importance
- **Employee home** (inspired by references/wallet-home.png):
  - Hero panel: large balance with small cents ("$2,981.40"), a gain pill if the investments are up, and the date of the last payday.
  - Two big rounded action pills, **Pay** and **Invest**, with a circular Face ID button between them (it opens Pay).
  - Bento row:
    - a "Your team card" tile (Design: $555 left, with the Fill gauge)
    - a "Your pay" tile with a small sparkline of pay plus investment value
  - "Recent" list in an inset grouped style (rounded group, hairline separators, round icons, amount on the trailing edge).
  - **Progressive disclosure:** everything else (payslip, earning, perks, holdings detail) is one tap away, not stacked on Home.
- **Lead home:** "N requests need you" as the hero (or "All clear" with an explanation); team budget card with each member's left; the team's rules (limits, vendors) as a tappable row → sheet.
- **Finance home:** company balance hero; the company map, with departments as cards carrying Fill gauges and "N waiting" badges; next-payday card with one "Review payday" button.
- **Contractor home:** "Paid to you" hero; "Send an invoice" primary; the invoice list with status chips.

### 4. Tasks as sheets
Pay, Invest (buy/sell, payday split), Approve detail, Run payday (preview → confirm), Send invoice, Add vendor/person/perk, Receipt detail. Bottom sheets on phone, centred sheets on desktop, with a clear title, Cancel and one primary action. Face ID confirmation is the last step of money-moving sheets.

### 5. Explain as you go (context tips, not a tour)
- A dismissible tip card at the top of each home, written for this role, with one sentence plus "Try it". Examples:
  - Sam: "Try paying PixelVault Stock. It's not on your team's list, so it'll wait for Ava. Then switch to Ava to approve it."
  - Ava: "Sam's request is waiting. Approve it, or approve and add the vendor so it goes through next time."
- Section headers each carry a one-line subtitle in plain language (for example "Team card: money your team gave you to spend on approved vendors").
- **Empty states explain why and what to do.**
- Remember dismissed tips in localStorage (wrapped in try/catch).

### 6. Visual system
- **Background:** #F5F5F7 (Apple light grey) on light screens; cards white with a 20–28 px radius and no heavy borders (a hairline or soft shadow at most).
- **Black** first screen and a dark hero panel where it helps contrast.
- **Accent:** Clay #E8552D only for primary actions, the active tab and the lid. Greys for everything else. Green and red only for gain/loss and status.
- **Type:** Inter Tight. Large titles 34/700; money in ExtraBold Italic; body 17/400; secondary 15/400 #6E6E73. No text below 13 px.
- **Spacing:** 8-pt grid; 16 px phone gutters; 44 px minimum touch targets.
- **Icons:** one consistent outline set (inline SVG; no emoji).
- **Motion:**
  - sheets slide up (250 ms, ease-out)
  - money "lands" with a brief count-up and a Fill block lighting
  - list rows fade in once
  - nothing loops except the first-screen float
  - prefers-reduced-motion removes it all
- Keep the banned-words rule for UI text.

### 7. Responsive
Phone first (375–430 px), then tablet and desktop. No horizontal scroll anywhere. The bottom tab bar respects the safe area (env(safe-area-inset-bottom)).

## Gates
- **All existing gates pass:** typecheck, test, build, e2e, e2e:passkey, check:banned, responsive and landing. Update e2e/responsive selectors where the UI changed; the flows must still be covered.
- **New check:** a first-screen → role sheet → Sam home → Pay sheet (held) → switch to Ava → approve journey, scripted with Playwright against local (scripts/journey-check.mjs). If the browser can't launch in your sandbox, say so; Claude will run it.
- **HANDOFF ("redesign"):** what changed per screen, and anything left undone.
