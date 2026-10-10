# Teampot app design spec (owner direction, 2026-10-10)

## First screen
Reference: `references/first-screen-3d-mark.png` (Monofact).
- A full-bleed black (or white) screen with the **Teampot pot mark rendered in 3D**: extruded glass or chrome with a soft liquid swirl inside the material, lit like a product shot. It must be our exact mark (ink bowl, lifted lid), not a reinterpretation.
- Tiny "Teampot" wordmark under it, and the flat white mark small at the bottom. Lots of empty space. Quiet and premium.
- It's the app's opening / welcome screen, before the demo picker or sign-in.

## Wallet home
Reference: `references/wallet-home.png` (Nina Skrbic). Inspiration, not a copy.
- **Hero balance on a soft tinted panel:** huge number with small cents ("$12,329,20" style), a currency chip and a gain pill (+2.1%).
- **Primary actions as big rounded pills** (Send / Request in the reference; for us Pay / Invest), with a centre scan or Face ID button.
- **Bento cards below:** "Send again" avatars (for us, frequent vendors or teammates), an income card with a small sparkline (pay plus investment growth), and recent activity rows with round icons.
- Rounded rectangles everywhere, generous radius, soft greys with one accent (Clay), dark pills for primary actions.

## Motion
Restrained, Apple-style, abstract: squares and rectangles sliding, scaling and settling; blocks filling (ties to the Fill gauge). Motion explains state changes (money landing, a card opening) and never decorates. Transform and opacity only, and respect reduce-motion.

## Priority
Functionality first; this spec guides the visual pass after the flows are solid.
