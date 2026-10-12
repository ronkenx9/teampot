# X (Twitter) header banner for Teampot

Make `brand/banner/banner.html`: a single self-contained HTML page whose body is exactly **1500×500 px**, which I will screenshot to PNG.

**Layout:**
- **Background:** white (#FFFFFF), or very slightly off-white (#F7F7F8) with a subtle tone. Clean, premium, Apple/Tempo-like.
- **Left side (about 45%):** text.
  - The logo mark `teampot-symbol.svg` (inline it) with the word "teampot" next to it: weight 400, tight tracking, black.
  - Headline in thin type (Geist 200–300 from Google Fonts, large, tight letter-spacing, black): "Work money that's actually yours."
  - One short line in grey: "Every team runs its own money · Built on Tempo"
  - Optionally a small mono label (Geist Mono, uppercase, grey): "teampot.xyz"
- **Right side:** the real app screens `s-sam-home.png`, `s-ava-home.png` and `s-jordan-home.png` (phone screenshots, 1170×2532), shown inside clean phone frames.
  - Black rounded bezel, about 56 px radius at full size, with a small dynamic-island pill. A 9:41 status bar is optional.
  - Stagger the phones: slightly overlapping, different heights, the middle one forward and largest, with soft natural shadows.
  - They may bleed off the bottom/right edge of the banner (that looks intentional and premium).
  - Optionally a very soft glow or light-beam accent in the brand clay #E8552D behind them. Keep it restrained.

**Safe zone:** X crops the banner on mobile, and the profile picture covers the bottom-left (roughly x 0–260, y 330–500). Keep all text above y≈330 and to the right of x≈60, vertically centred in the upper area.

**Rules:**
- No emojis, no fake UI, no lorem.
- Thin type only; no heavy bold display type.
- Use relative paths to the images in this folder.

Use Codex image generation only if it genuinely improves the result (for example a subtle background texture). The app screens must be the real PNGs, not regenerated.

When done, list the files you created.
