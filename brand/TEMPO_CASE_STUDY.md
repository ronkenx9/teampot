# Tempo.xyz case study: component by component

Measured from tempo.xyz's live code (computed styles, 1440 px and 390 px viewports, 2026-10-10). Their font is Pilat (licensed); we use Inter Tight at the same weights and tracking.

| Component | Tempo (measured) | Teampot before | Change |
|---|---|---|---|
| Page ground | `#F5F5F5`, text `#000` | `#F6F4F0` warm paper / `#F5F5F7` | `#F5F5F5`, black text |
| Type voice | One weight: **500**, upright. Never italic, never bold | 800 italic everywhere (headlines, money, card titles) | 500 upright everywhere; 400 for big numbers |
| H1 | 53px, line-height 0.95, tracking −0.04em, centered, 2 lines | 120px+ italic 800, left-aligned, 5 lines | 56px / 0.95 / −0.04em, centered, 2 lines |
| H2 | 36px, line-height 1.1, tracking −0.02em, max 600px wide | 64px italic 800 | 36px / 1.1 / −0.02em |
| H3 (tab title) | 30px / 1.1 / −0.02em, inactive tabs at 40% black | n/a | same |
| Body | 16px / 22px, weight 500, `rgba(0,0,0,.56)` | 18px 400 dark gray | 16/22 500 at 56% black |
| Eyebrow | 10px, 500, uppercase, +0.06em, `rgba(0,0,0,.4)` | 12px bold Clay orange | same as Tempo |
| Big numbers | 54px **weight 400**, tracking −0.04em | italic 800 | 400, −0.04em |
| Nav | Floating centered pill: `rgba(225,225,225,.6)` + `blur(20px)`, radius 26, height 52, padding 4/4/4/24; links 14px 500; black "Contact" pill | Flat full-width bar, square black button | Same floating pill |
| Primary button | Black pill, 14px 500, height 44–48, padding 0 24–32px | Clay orange pill, bold | Black pill |
| Secondary button | `rgba(0,0,0,.04)` (or `rgba(194,194,194,.24)`) pill, black text | Text link | Gray pill |
| Accent color | None in the chrome. Color only inside product illustrations (purple chart bars, green "7% APY" pill) | Clay on buttons, eyebrows, numbers, links, borders | Clay only in the logo and inside product mocks |
| Card | White, radius **32**, no border, no shadow, padding 64/64/12 for copy, illustration fills the bottom | White, 1px border, radius 8, italic titles, orange number badges | White, radius 32, borderless; line-art illustration |
| Product showcase | Left: list of products with 1px dividers (`rgba(0,0,0,.16)`); active black, inactive gray. Right: gray panel radius 32 holding a **white mock of the real UI** (balance, chart, segmented control) | Static screenshots in a tilted collage | Tabbed list + live HTML mocks of Teampot screens |
| Stats | Top border 1px `rgba(0,0,0,.16)`, padding-top 23, number 54/400, label 14/500 at 56% | Bordered boxes with italic words | Same as Tempo, real measured numbers |
| Statement band | Full-bleed dark photo, serif quote (HB Set) | none | Full-bleed dark band, serif line (Instrument Serif) |
| Diagram | Monochrome line art (thin gray strokes, black nodes, one black path) | Funnel boxes with orange ticks | Line-art key tree: treasury → departments → heads → cards |
| CTA | Two white cards, radius 64, padding 64, eyebrow + 22px title + gray body + pill | One orange button | Same two-card CTA |
| Footer | Black, 4–5 link columns, 14px 500, white headings, gray links | One-line footer | Black column footer |
| Section rhythm | Padding 160 top (100 for the first), 60 sides, max 1320, heading → grid gap 48, grid gap 24 | Mixed, 1px rules between sections | Same rhythm, no rules |
| Mobile | Same components stacked; nav pill collapses to logo + menu; buttons stay side by side | Huge italic wraps, cramped buttons | Same stacking |

## App (same system)
- Cards radius 24–28, white on `#F5F5F5`, no borders; rows separated by 1px `rgba(0,0,0,.08)`.
- Money: weight 400–500, tight tracking (Tempo's `$12,504.61` mock), never italic.
- Primary actions black pills; Clay reserved for the logo, the "You" marker and approval warnings.
- Bottom tab bar becomes Tempo's floating blurred pill.
- Section labels use the eyebrow style.
