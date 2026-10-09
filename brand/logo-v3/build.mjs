import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as opentype from "../node_modules/opentype.js/dist/opentype.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontPath = path.resolve(here, "../node_modules/@fontsource/inter-tight/files/inter-tight-latin-800-italic.woff");
const font = opentype.parse(readFileSync(fontPath).buffer);

const C = {
  clay: "#E8552D",
  ink: "#141414",
  paper: "#F6F4F0",
  paperLine: "#E6E0D8",
  muted: "#7A746C",
  white: "#FFFFFF",
};

const concepts = [
  {
    id: "a-mobile",
    name: "Balanced Mobile",
    note: "Independent team budgets hang from one balanced company mechanism.",
    symbol: symbolMobile,
  },
  {
    id: "b-rooms",
    name: "Rooms",
    note: "Every team gets its own room inside one financial house.",
    symbol: symbolRooms,
  },
  {
    id: "c-keyring",
    name: "Key Ring",
    note: "Every team holds its own spending key, all kept on one ring.",
    symbol: symbolKeyring,
  },
];

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svg(w, h, body, title = "Teampot logo") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${esc(title)}</title>${body}</svg>\n`;
}

function rounded(x, y, w, h, r, fill, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra}/>`;
}

function circle(cx, cy, r, fill, extra = "") {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
}

function rotate(cx, cy, deg) {
  return ` transform="rotate(${deg} ${cx} ${cy})"`;
}

function wordmark(size, fill) {
  const track = -0.035 * size;
  let x = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = 0;
  const parts = [];

  for (const ch of "teampot") {
    const glyph = font.charToGlyph(ch);
    const p = glyph.getPath(x, 0, size);
    const bb = p.getBoundingBox();
    minY = Math.min(minY, bb.y1);
    maxY = Math.max(maxY, bb.y2);
    maxX = Math.max(maxX, bb.x2);
    parts.push(`<path fill="${fill}" d="${p.toPathData(1)}"/>`);
    x += glyph.advanceWidth * (size / font.unitsPerEm) + track;
  }

  return { body: parts.join(""), width: Math.ceil(maxX), minY, maxY };
}

function symbolMobile({ ink = C.ink, clay = C.clay, paper = C.paper, mono = false } = {}) {
  const accent = mono ? ink : clay;
  return [
    rounded(90, 28, 76, 16, 8, ink),
    rounded(124, 44, 8, 34, 4, ink),
    rounded(48, 83, 160, 14, 7, ink, rotate(128, 90, -7)),
    rounded(70, 111, 8, 39, 4, ink),
    rounded(182, 96, 8, 42, 4, ink),
    rounded(50, 145, 94, 12, 6, ink, rotate(97, 151, 8)),
    rounded(104, 158, 8, 33, 4, ink),
    rounded(78, 194, 100, 12, 6, ink, rotate(128, 200, -5)),
    rounded(33, 112, 42, 42, 12, accent),
    rounded(171, 132, 48, 48, 14, paper === C.ink ? C.white : ink),
    rounded(78, 164, 40, 40, 11, paper === C.ink ? C.white : ink),
    rounded(139, 188, 44, 44, 12, accent),
    circle(128, 82, 11, accent),
  ].join("");
}

function symbolRooms({ ink = C.ink, clay = C.clay, paper = C.paper, mono = false } = {}) {
  const accent = mono ? ink : clay;
  const base = paper === C.ink ? C.white : ink;
  const gap = paper === C.ink ? C.ink : C.paper;
  const cells = [
    [42, 42, 58, 72, 16, base],
    [108, 42, 106, 72, 16, accent],
    [42, 122, 86, 52, 15, base],
    [136, 122, 78, 52, 15, base],
    [42, 182, 122, 32, 14, base],
    [172, 182, 42, 32, 14, accent],
  ];
  const rooms = cells.map(([x, y, w, h, r, fill]) => rounded(x, y, w, h, r, fill)).join("");
  return [
    rounded(32, 32, 192, 192, 34, gap),
    rooms,
    rounded(118, 91, 20, 84, 10, gap),
    rounded(90, 108, 96, 20, 10, gap),
    rounded(151, 159, 20, 50, 10, gap),
  ].join("");
}

function symbolKeyring({ ink = C.ink, clay = C.clay, paper = C.paper, mono = false } = {}) {
  const accent = mono ? ink : clay;
  const cut = paper === C.ink ? C.ink : C.paper;
  const outer = `<path fill="${ink}" fill-rule="evenodd" d="M128 25a103 103 0 1 1 0 206a103 103 0 0 1 0-206Zm0 42a61 61 0 1 0 0 122a61 61 0 0 0 0-122Z"/>`;
  return [
    outer,
    rounded(155, 20, 76, 32, 16, accent, rotate(128, 128, 35)),
    rounded(26, 96, 70, 30, 15, ink, rotate(128, 128, -16)),
    rounded(87, 201, 68, 30, 15, ink, rotate(128, 128, 78)),
    rounded(178, 40, 20, 10, 5, cut, rotate(128, 128, 35)),
    rounded(200, 56, 14, 10, 5, cut, rotate(128, 128, 35)),
    circle(128, 128, 18, accent),
  ].join("");
}

function symbolSvg(concept, mode = "color") {
  const opts =
    mode === "mono"
      ? { ink: C.ink, clay: C.ink, paper: C.paper, mono: true }
      : mode === "reversed"
        ? { ink: C.white, clay: C.clay, paper: C.ink }
        : {};
  const bg = mode === "reversed" ? rounded(0, 0, 256, 256, 0, C.ink) : "";
  return svg(256, 256, `${bg}${concept.symbol(opts)}`, `Teampot ${concept.name} symbol`);
}

function lockupSvg(concept, mode = "color") {
  const ink = mode === "reversed" ? C.white : C.ink;
  const opts =
    mode === "mono"
      ? { ink, clay: ink, paper: C.paper, mono: true }
      : mode === "reversed"
        ? { ink: C.white, clay: C.clay, paper: C.ink }
        : {};
  const wm = wordmark(132, ink);
  const width = Math.ceil(222 + wm.width + 24);
  const bg = mode === "reversed" ? rounded(0, 0, width, 256, 0, C.ink) : "";
  const body = [
    bg,
    `<g transform="translate(0 28) scale(0.78)">${concept.symbol(opts)}</g>`,
    `<g transform="translate(222 166)">${wm.body}</g>`,
  ].join("");
  return svg(width, 256, body, `Teampot ${concept.name} horizontal lockup`);
}

function checkSvg(concept) {
  const sizes = [16, 32, 64];
  const cells = sizes.map((size, i) => {
    const x = 18 + i * 92;
    const y = 82 - size / 2;
    return `<g transform="translate(${x} ${y}) scale(${size / 256})">${concept.symbol({})}</g>`;
  });
  return svg(286, 128, cells.join(""), `Teampot ${concept.name} 16 32 64 px check`);
}

function htmlCard(concept) {
  return `<section class="card">
    <div class="meta"><span>${esc(concept.name)}</span><small>${esc(concept.note)}</small></div>
    <div class="lockup">${lockupSvg(concept).replace(/<\?xml.*?\?>/g, "")}</div>
    <div class="variants">
      <div>${symbolSvg(concept)}</div>
      <div>${lockupSvg(concept, "mono")}</div>
      <div>${lockupSvg(concept, "reversed")}</div>
      <div class="checks">${checkSvg(concept)}</div>
    </div>
  </section>`;
}

function overviewHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teampot logo v3 concepts</title>
<style>
:root{--clay:${C.clay};--ink:${C.ink};--paper:${C.paper};--line:${C.paperLine};--muted:${C.muted}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Inter Tight",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;width:1440px;padding:44px}
header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px}
h1{font-size:34px;line-height:1;font-weight:800;font-style:italic;margin:0;letter-spacing:-.03em}
p{margin:0;color:var(--muted);font-size:14px;max-width:420px;line-height:1.45}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.card{background:white;border:1px solid var(--line);border-radius:8px;padding:24px;display:flex;flex-direction:column;gap:22px;min-height:740px}
.meta{display:flex;flex-direction:column;gap:8px}
.meta span{font-size:20px;font-weight:800;font-style:italic;letter-spacing:-.02em}
.meta small{font-size:13px;line-height:1.35;color:var(--muted);min-height:36px}
.lockup{height:150px;display:flex;align-items:center}
.lockup svg{width:100%;height:auto}
.variants{display:grid;grid-template-columns:1fr;gap:14px}
.variants>div{min-height:110px;border:1px solid var(--line);border-radius:8px;background:var(--paper);display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden}
.variants svg{max-width:100%;height:auto}
.variants>div:first-child svg{width:96px}
.checks svg{width:240px}
</style>
</head>
<body>
<header><h1>Teampot logo v3</h1><p>Three code-drawn routes for "Every team runs its own money." Palette: Clay ${C.clay}, Ink ${C.ink}, Paper ${C.paper}. Wordmark: Inter Tight 800 Italic converted to paths.</p></header>
<main class="grid">${concepts.map(htmlCard).join("")}</main>
</body>
</html>\n`;
}

function overviewSvg() {
  const wm = wordmark(64, C.ink);
  const cards = concepts.map((concept, i) => {
    const x = 48 + i * 448;
    return `<g transform="translate(${x} 120)">
      ${rounded(0, 0, 400, 560, 8, C.white)}
      <g transform="translate(72 34) scale(0.45)">${concept.symbol({})}</g>
      <g transform="translate(76 210)">${lockupSvg(concept).replace(/^<svg[^>]*>|<\/svg>\n?$/g, "")}</g>
      <g transform="translate(62 355)">${checkSvg(concept).replace(/^<svg[^>]*>|<\/svg>\n?$/g, "")}</g>
      <text x="30" y="512" fill="${C.ink}" font-family="Inter Tight, Arial, sans-serif" font-size="24" font-weight="800" font-style="italic">${esc(concept.name)}</text>
      <text x="30" y="538" fill="${C.muted}" font-family="Inter Tight, Arial, sans-serif" font-size="13">${esc(concept.note)}</text>
    </g>`;
  }).join("");
  const title = `<g transform="translate(48 72)">${wm.body}</g><text x="420" y="70" fill="${C.muted}" font-family="Inter Tight, Arial, sans-serif" font-size="18">logo v3 concept board</text>`;
  return svg(1440, 760, `${rounded(0, 0, 1440, 760, 0, C.paper)}${title}${cards}`, "Teampot logo v3 concept overview");
}

mkdirSync(here, { recursive: true });

for (const concept of concepts) {
  writeFileSync(path.join(here, `${concept.id}-symbol.svg`), symbolSvg(concept));
  writeFileSync(path.join(here, `${concept.id}-lockup.svg`), lockupSvg(concept));
  writeFileSync(path.join(here, `${concept.id}-onecolor.svg`), lockupSvg(concept, "mono"));
  writeFileSync(path.join(here, `${concept.id}-reversed.svg`), lockupSvg(concept, "reversed"));
  writeFileSync(path.join(here, `${concept.id}-check.svg`), checkSvg(concept));
}

writeFileSync(path.join(here, "concepts.html"), overviewHtml());
writeFileSync(path.join(here, "concepts.svg"), overviewSvg());

console.log(`Wrote ${concepts.length} Teampot logo v3 concepts to ${path.relative(process.cwd(), here)}`);
