# Teampot pass 5: landing page and brand kit (Codex brief)

Rules from BUILD_BRIEF.md still apply: testnet only; never touch app/.env.deploy, app/.env.local or app/.vercel; no deploy or push; no AI attribution; git is read-only in your sandbox, so leave changes uncommitted. Use PORT=8790.

## Positioning (use these words; don't invent new taglines)
- **Headline:** "Every team runs its own money."
- **Supporting line:** "Finance sets the frame. Departments decide. Everyone's paid and spends from their phone, with limits the network enforces."
- **The problem:** every money decision in a company gets choked up to one admin desk.
- **Built on Tempo** (payments blockchain by Stripe and Paradigm). On the landing page only, we can say it plainly: each department is its own account, and its spending rules are enforced by the network, not a spreadsheet. Inside the app, the banned-words rule still applies.

## Brand assets (locked; do not redesign)
- Logo: brand/logo-v4/final/ (`teampot-logo.svg`, `teampot-logo-reversed.svg`, the symbol files, app icons, web icons).
- Palette: Clay #E8552D (accent), Ink #141414, Paper #F6F4F0, plus neutrals.
- Type: Inter Tight. Money and headlines in ExtraBold Italic.
- The 4×4 "Fill" block gauge is a UI element (budget left), not the logo.

## 1. Landing page
- **Routing:** the landing page is served at `/`, and the app moves to `/app` (update routing, the PWA start_url, invite links and README). It's one Vite app or a static page in web/; your choice, but keep the single Vercel deploy working.
- **Sections:**
  1. Hero: headline, supporting line, "Open the live demo" (→ /app), and a real product shot. Capture real screenshots of the running app with Playwright, or render real UI components; no fake mockups.
  2. The problem, in one sentence plus a simple visual: every request funnels to one desk.
  3. How it works, in 3 steps: Finance funds departments → heads set their team's rules → everyone pays from their phone.
  4. For Finance / Department heads / Everyone: one line each.
  5. Why it's different: rules enforced by the network, departments are real accounts, Face ID instead of cards, payday in one transaction. Link "See what's verified" → VERIFIED.md on GitHub (https://github.com/ronkenx9/teampot/blob/main/app/VERIFIED.md).
  6. Footer: GitHub link, "Demo company · test money".
- **Craft:** mobile-first, fast (no heavy libraries), calm and premium, generous whitespace, one accent colour, real UI instead of illustrations. Motion is subtle and transform/opacity only. Lighthouse-friendly: semantic HTML, alt text, meta and OG tags (OG image built from the logo plus the headline).
- Avoid generic AI-landing-page tropes: three-column icon feature grids with emoji, gradient text, "seamless/empower/unlock", fake testimonials, fake logos or fake stats.

## 2. Brand kit board
- `brand/kit-v4/board.html` plus a PNG (Playwright screenshot): logo (primary, reversed, symbol), clear space and minimum size, palette with hex codes, type, app icon, the Fill gauge as a UI element, and 2–3 real product screens.
- `brand/kit-v4/GUIDELINES.md`.

## Gates
- All existing gates in app/GATES.md still pass, with the app now at /app.
- **G12 Landing:** a Playwright check loads / at 375 and 1280 px with no overflow and no console errors, and "Open the live demo" reaches a working /app.
- Update HANDOFF ("pass 5").
