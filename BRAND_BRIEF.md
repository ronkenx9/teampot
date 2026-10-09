# Teampot logo (Codex brand brief)

Only write inside `brand/logo-v3/`. Do not touch app/ or any other folder. No deploys, no pushes, and no git commits (git is read-only).

## Who we are now
- **Pitch:** "Every team runs its own money."
- Teampot gives every department its own budget and rules on one app (powered by the Tempo payments network). Finance sets the frame, departments decide, and everyone is paid and spends from their phone.
- **Personality:** calm, confident, modern, decentralised, grown-up. Not playful, no mascot.

## Your role
Act as Chief Brand Designer, using this prompt as your operating brief, minus the mascot section:

> You are now my Chief Brand Designer, Creative Director, UX Strategist, and Visual Systems Partner … avoid generic AI-looking branding, avoid overcomplicated logos, make everything intentional, clean, memorable, give strong opinions, say when something is weak and improve it, premium, minimal, expressive, demo-ready, always explain the reasoning.

## Research and metaphors (do this first, write it to brand/logo-v3/RESEARCH.md)
1. **Category audit.** How do Ramp, Brex, Mercury, Rippling, Deel, Gusto, Linear and Notion mark themselves? List the category clichés to avoid: upward arrows, coins, piggy banks, shields, globes, people-in-a-circle, org-chart boxes, trees, honeycombs, pie charts, generic blue.
2. **Metaphors** for "every team runs its own money" / decision-making moved to the edges / one whole made of independent parts. Starting points: a Calder kinetic mobile (independent arms, one balance); a floor plan of rooms; keys on a ring (each team holds its own key, the literal Tempo mechanism); river deltas; nested blocks; the existing block "Fill" gauge in brand/generative/index.html. Find better ones too. Score each on clarity, distinction, simplicity, relevance and 16 px strength.
3. Pick the **3 strongest and most different** concepts.

## Build (code-drawn vector, like brand/generative)
- Draw every mark with code: a Node/JS script `brand/logo-v3/build.mjs` that writes clean SVGs (no `<text>` in final marks; outline the wordmark from Inter Tight 800 Italic with opentype.js, using the font in brand/node_modules/@fontsource/inter-tight).
- For each concept, write:
  - a symbol SVG
  - a horizontal lockup SVG
  - a one-colour version
  - a reversed (on Ink) version
  - a 16/32/64 px check
- Make a concept overview image: `brand/logo-v3/concepts.html` plus a PNG, if you can render it. If you can't render, say so.
- Palette: Clay #E8552D, Ink #141414, Paper #F6F4F0.
- The symbol should be able to double as a **live** element in the app if possible (like Fill, which shows budget left), but not at the cost of being a strong mark.

## Deliver
`brand/logo-v3/RECOMMENDATION.md`: the 3 concepts with one-line ideas, your recommendation with honest risks, and how the chosen mark animates (motion idea in 2–3 sentences, built from the mark's own geometry). Stop there; the owner picks before any full kit.
