// Teampot brand kit generator: outlined masters (SVG) + bento brand board (HTML).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import opentype from "opentype.js";

export const C = {
  ink: "#141414",
  paper: "#F6F4F0",
  clay: "#E8552D",
  clayDeep: "#B8401C",
  sand: "#F1E4D8",
};

// ---- Symbol (A · T-Pot, refined): rim = T crossbar, narrower bowl = T stem, coin drops in.
const symbolParts = (rim, bowl, coin) => [
  `<rect x="24" y="100" width="208" height="32" rx="16" fill="${rim}"/>`,
  `<path fill="${bowl}" d="M56 140 H200 A72 72 0 0 1 56 140 Z"/>`,
  `<circle cx="128" cy="62" r="22" fill="${coin}"/>`,
].join("");
const symbol = (rim = C.ink, bowl = C.clay, coin = C.ink) => symbolParts(rim, bowl, coin);

// ---- Wordmark: Inter Tight ExtraBold Italic, outlined, tight tracking; the "o" is the pot.
const font = opentype.parse(readFileSync("node_modules/@fontsource/inter-tight/files/inter-tight-latin-800-italic.woff").buffer);
function wordmark(size, ink, accent) {
  const track = -0.045 * size;
  let x = 0;
  const parts = [];
  let minY = Infinity, maxY = -Infinity, maxX = 0;
  for (const ch of "teampot") {
    const g = font.charToGlyph(ch);
    const p = g.getPath(x, 0, size);
    const bb = p.getBoundingBox();
    minY = Math.min(minY, bb.y1); maxY = Math.max(maxY, bb.y2); maxX = Math.max(maxX, bb.x2);
    parts.push(`<path fill="${ch === "o" ? accent : ink}" d="${p.toPathData(1)}"/>`);
    x += g.advanceWidth * (size / font.unitsPerEm) + track;
  }
  return { body: parts.join(""), width: maxX, minY, maxY };
}

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title>${body}</svg>\n`;

function lockupH(ink = C.ink, accent = C.clay, sym = symbol()) {
  const wm = wordmark(140, ink, accent);
  const sc = 1.0, gap = 44, symW = 208 * sc; // rim spans x 24..232 in the 256 box
  const wmX = symW + gap;
  // baseline at y=168 so the x-height sits centred on the symbol's rim/bowl
  const body = `<g transform="translate(${-24 * sc} 2) scale(${sc})">${sym}</g><g transform="translate(${wmX} 168)">${wm.body}</g>`;
  return svg(Math.ceil(wmX + wm.width + 8), 256, body, "Teampot logo horizontal");
}
function lockupStacked(ink = C.ink, accent = C.clay, sym = symbol()) {
  const wm = wordmark(110, ink, accent);
  const w = Math.ceil(Math.max(256, wm.width + 16));
  const body = `<g transform="translate(${(w - 256) / 2} 0)">${sym}</g><g transform="translate(${(w - wm.width) / 2} 350)">${wm.body}</g>`;
  return svg(w, 384, body, "Teampot logo stacked");
}
const appIcon = (bg, rim, bowl, coin) =>
  svg(256, 256, `<rect width="256" height="256" rx="56" fill="${bg}"/><g transform="translate(38.4 40) scale(0.7)">${symbol(rim, bowl, coin)}</g>`, "Teampot app icon");

const out = "kit/";
mkdirSync(out, { recursive: true });
const files = {
  "teampot-symbol-color.svg": svg(256, 256, symbol(), "Teampot symbol"),
  "teampot-symbol-black.svg": svg(256, 256, symbol(C.ink, C.ink, C.ink), "Teampot symbol black"),
  "teampot-symbol-white.svg": svg(256, 256, symbol("#FFFFFF", "#FFFFFF", "#FFFFFF"), "Teampot symbol white"),
  "teampot-logo-horizontal-color.svg": lockupH(),
  "teampot-logo-horizontal-black.svg": lockupH(C.ink, C.ink, symbol(C.ink, C.ink, C.ink)),
  "teampot-logo-horizontal-white.svg": lockupH("#FFFFFF", C.clay, symbol("#FFFFFF", C.clay, "#FFFFFF")),
  "teampot-logo-stacked-color.svg": lockupStacked(),
  "teampot-app-icon-light.svg": appIcon(C.paper, C.ink, C.clay, C.ink),
  "teampot-app-icon-dark.svg": appIcon(C.ink, "#FFFFFF", C.clay, "#FFFFFF"),
  "teampot-app-icon-clay.svg": appIcon(C.clay, "#FFFFFF", C.ink, "#FFFFFF"),
};
for (const [n, s] of Object.entries(files)) writeFileSync(out + n, s);

// ---- Bento brand board (inline SVG so it renders anywhere)
const inline = (s, cls = "") => s.replace("<svg ", `<svg class="${cls}" `);
const grid = () => {
  const lines = [];
  for (let i = 0; i <= 256; i += 16) lines.push(`<line x1="${i}" y1="0" x2="${i}" y2="256"/><line x1="0" y1="${i}" x2="256" y2="${i}"/>`);
  return `<svg class="mark" viewBox="-16 -16 288 288"><g stroke="#d9d4cc" stroke-width="0.6">${lines.join("")}</g>
  <g fill="none" stroke="${C.clay}" stroke-width="1.2" stroke-dasharray="4 4"><circle cx="128" cy="140" r="72"/><circle cx="128" cy="62" r="22"/><line x1="128" y1="0" x2="128" y2="256"/><line x1="0" y1="140" x2="256" y2="140"/></g>
  <g opacity="0.92">${symbol()}</g>
  <g font-family="Inter Tight, Helvetica, sans-serif" font-size="7" fill="#8a847c"><text x="210" y="96">32u rim</text><text x="150" y="232">r = 72</text><text x="154" y="44">r = 22</text></g></svg>`;
};
const swatch = (name, hex, fg, note) =>
  `<div class="sw" style="background:${hex};color:${fg}"><b>${name}</b><span>${hex}</span><span>${note}</span></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Teampot — Brand Kit</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,700;1,800&display=swap" rel="stylesheet">
<style>
:root{--ink:${C.ink};--paper:${C.paper};--clay:${C.clay};--deep:${C.clayDeep};--sand:${C.sand}}
*{box-sizing:border-box;margin:0}
body{background:#E9E5DF;font-family:"Inter Tight",system-ui,sans-serif;color:var(--ink);padding:40px;width:1680px}
.board{display:grid;grid-template-columns:repeat(12,1fr);gap:20px}
.p{border-radius:28px;overflow:hidden;position:relative;min-height:300px;display:flex;align-items:center;justify-content:center}
.lbl{position:absolute;top:22px;left:26px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
.w{background:#fff}.ink{background:var(--ink);color:#fff}.clay{background:linear-gradient(135deg,#F26A3F 0%,var(--clay) 45%,var(--deep) 100%);color:#fff}.sand{background:var(--sand)}
.mark{width:72%;height:auto}
.s7{grid-column:span 7}.s5{grid-column:span 5}.s4{grid-column:span 4}.s8{grid-column:span 8}.s6{grid-column:span 6}.s12{grid-column:span 12}.s3{grid-column:span 3}
.h{min-height:520px}
.icons{display:flex;gap:40px}.icons svg{width:150px;height:150px;filter:drop-shadow(0 18px 30px rgba(0,0,0,.18))}
.banner{justify-content:space-between;padding:56px 64px;align-items:stretch;flex-direction:column}
.banner h2{font-size:58px;line-height:1.02;font-weight:500;letter-spacing:-.035em;max-width:640px}
.banner .out{position:absolute;right:-40px;bottom:-60px;width:460px;opacity:.95}
.type{flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:40px 44px;gap:18px}
.type .big{font-size:120px;font-weight:800;font-style:italic;letter-spacing:-.05em;line-height:.9}
.type .row{display:flex;gap:56px;font-size:15px;line-height:1.6;opacity:.85}
.sw{flex:1;height:100%;padding:26px;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;font-size:14px}
.sw b{font-size:20px;font-weight:700}
.pal{padding:0;align-items:stretch}
.three{background:radial-gradient(120% 90% at 30% 20%,#FF8A5E 0%,var(--clay) 40%,#7A240C 100%)}
.three .mark{width:62%;filter:drop-shadow(0 30px 40px rgba(60,10,0,.45))}
.card{background:#fff;border-radius:22px;width:78%;padding:28px 30px;box-shadow:0 20px 50px rgba(0,0,0,.12);font-size:15px}
.card .t{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;font-weight:700}
.bar{height:10px;border-radius:6px;background:#eee;margin:8px 0 16px;overflow:hidden}.bar i{display:block;height:100%;background:var(--clay)}
.pill{background:var(--sand);color:var(--deep);border-radius:99px;padding:6px 12px;font-size:13px;font-weight:700}
.big-num{font-size:44px;font-weight:800;font-style:italic;letter-spacing:-.04em}
.lock svg{width:78%;height:auto}
.foot{grid-column:span 12;display:flex;justify-content:space-between;font-size:13px;opacity:.5;padding:6px 8px 0}
</style></head><body><div class="board">
<div class="p w s7 h"><span class="lbl">Construction · 16u grid</span>${grid()}</div>
<div class="p w s5 h lock" style="flex-direction:column;gap:60px"><span class="lbl">Primary lockup</span>${inline(files["teampot-logo-horizontal-color.svg"])}${inline(files["teampot-logo-stacked-color.svg"]).replace('class=""','style="width:46%;height:auto"')}</div>
<div class="p clay s4"><span class="lbl">App icon</span><div class="icons">${inline(files["teampot-app-icon-light.svg"])}${inline(files["teampot-app-icon-dark.svg"])}</div></div>
<div class="p ink s8 banner"><span class="lbl" style="opacity:.4">Voice</span><div style="height:30px"></div><h2>Budgets your team actually wants to save.</h2>
<div style="font-size:17px;opacity:.6;max-width:520px;margin-top:22px">Team budgets, payroll and contractor pay in one place. Every dollar earns until it's spent.</div>
${inline(svg(256, 256, symbolParts("none", "none", "none").replace(/fill="none"/g, `fill="none" stroke="${C.clay}" stroke-width="2"`), "outline"), "out")}</div>
<div class="p three s4 h"><span class="lbl" style="color:#fff">Symbol</span>${inline(files["teampot-symbol-white.svg"], "mark")}</div>
<div class="p sand s8 h"><span class="lbl">Product</span><div class="card">
<div class="t"><span>Q4 team budgets</span><span class="pill">Earning while unspent · $1,284</span></div>
<div>Engineering <span style="float:right">$31,200 of $40,000</span></div><div class="bar"><i style="width:78%"></i></div>
<div>Design <span style="float:right">$10,800 of $15,000</span></div><div class="bar"><i style="width:72%"></i></div>
<div>Marketing <span style="float:right">$22,400 of $25,000</span></div><div class="bar"><i style="width:90%"></i></div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;border-top:1px solid #eee;padding-top:20px">
<div><div style="opacity:.6">Design kept this quarter</div><div class="big-num" style="color:var(--clay)">$4,510</div></div>
<div style="text-align:right;opacity:.6">Kudos pool split across<br>6 teammates</div></div></div></div>
<div class="p ink s6 type"><span class="lbl" style="opacity:.4">Typography</span><div class="big">Inter Tight</div>
<div class="row"><div><b>ExtraBold Italic</b><br>Wordmark &amp; numbers</div><div><b>Medium</b><br>Headlines</div><div><b>Regular</b><br>Body &amp; UI</div></div>
<div style="font-size:15px;opacity:.6">Aa Bb Cc 0123456789 $ % · Open Font License</div></div>
<div class="p s6 pal"><span class="lbl" style="z-index:2">Palette</span>
${swatch("Clay", C.clay, "#fff", "Signature · CTAs, the pot")}${swatch("Ink", C.ink, "#fff", "Text, rim, coin")}${swatch("Paper", C.paper, C.ink, "Backgrounds")}${swatch("Sand", C.sand, C.clayDeep, "Surfaces, pills")}${swatch("Clay Deep", C.clayDeep, "#fff", "Small text on light")}</div>
<div class="p clay s12 lock" style="min-height:280px"><span class="lbl">Reversed on Clay</span>${inline(lockupH("#FFFFFF", C.ink, symbol("#FFFFFF", C.ink, "#FFFFFF"))).replace('class=""','style="width:52%;height:auto"')}</div>
<div class="foot"><span>Teampot — Brand Kit v1</span><span>Built on Tempo</span></div>
</div></body></html>`;
writeFileSync(out + "board.html", html);
console.log("kit ok");
