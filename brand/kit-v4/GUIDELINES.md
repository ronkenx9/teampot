# Teampot brand guidelines (v4)

**Line:** Every team runs its own money.
**Support:** Finance sets the frame. Departments decide. Everyone's paid and spends from their phone, with limits the network enforces.

## Logo
- **Mark:** an ink bowl with a clay lid lifted off it, the team's pot opened up. The master files are in `../logo-v4/final/`. Don't redraw, recolour, stretch, rotate, outline, or add shadows or gradients.
- **Lockups:** `teampot-logo.svg` (primary, on light), `teampot-logo-reversed.svg` (on Ink), `teampot-logo-black.svg` (one colour).
- **Symbol:**
  - `teampot-symbol.svg` (ink bowl, clay lid) on light backgrounds
  - `teampot-symbol-reversed.svg` (white bowl, clay lid) on Ink
  - on Clay, use a white bowl with an ink lid
- **Clear space:** the lid's height on every side.
- **Minimum size:** symbol 16 px; lockup 96 px wide.
- **App icons:** `teampot-app-icon.svg` (Ink, default), `-light`, `-clay`.
- **Web icons:** `../logo-v4/final/web/`.

## Colour
| Name | HEX | Use |
|---|---|---|
| Clay | #E8552D | The lid. Accent and primary actions only; never large text on light |
| Ink | #141414 | The bowl. Text and dark surfaces |
| Paper | #F6F4F0 | Backgrounds |
| Clay Deep | #B8401C | Small clay text on light (AA contrast) |

## Type
Inter Tight (Open Font License).
- **ExtraBold Italic:** money figures, headlines, the wordmark.
- **Medium:** section titles.
- **Regular:** body and interface.

## UI elements
- **Fill gauge:** a 4×4 grid of rounded blocks; lit blocks are the money left in a pot, filling from the bottom. It's a UI element, not the logo.
- **Motion:** for feedback only (a block lights up when money lands, a node pulses when a decision waits). Transform and opacity only, and respect reduced motion.

## Voice
Grown-up and short. In the product: dollars, Face ID, receipt, held for approval, department. Never wallet, gas, token, chain or stablecoin. On the landing page we can say it plainly: built on Tempo, rules enforced by the network.

The board is in `board.html` / `board.png`, rebuilt with `node build-board.mjs`.
