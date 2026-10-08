// Round-2 logo concepts for TEAMPOT (team budgets that reward saving), Tempo-style base + one signature colour.
import { writeFileSync } from "node:fs";

const INK = "#141414";
const CLAY = "#E8552D"; // terracotta: the colour of a clay pot

const svg = (w, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 256" width="${w}" height="256" role="img"><title>${title}</title>${body}</svg>\n`;

// A — T-Pot: the rim is the T's crossbar, the bowl its stem; a coin drops in. (Teampot ≈ teapot.)
const aBody = `<rect x="24" y="104" width="208" height="32" rx="16" fill="${INK}"/><path fill="${CLAY}" d="M40 144 H216 A88 88 0 0 1 40 144 Z"/><circle cx="128" cy="60" r="24" fill="${INK}"/>`;

// B — Round Table: four seats around one pot; the seat that saved takes the pot's colour.
const seats = [[128, 32], [224, 128], [128, 224], [32, 128]]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="26" fill="${i === 1 ? CLAY : INK}"/>`).join("");
const bBody = `<circle cx="128" cy="128" r="52" fill="${CLAY}"/>${seats}`;

// C — Pot-o wordmark: Tempo-style heavy italic; the o is the pot, filled with the signature colour.
const word = (x, y, size, potO = true) =>
  `<text x="${x}" y="${y}" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="${size}" letter-spacing="-${(size * 0.045).toFixed(1)}" transform="skewX(-15)" fill="${INK}">teamp<tspan fill="${potO ? CLAY : INK}">o</tspan>t</text>`;
const cBody = `<g transform="skewX(-15) translate(40 0)"><path fill="${CLAY}" fill-rule="evenodd" d="M128 56 A84 84 0 1 0 128 224 A84 84 0 1 0 128 56 Z M128 104 A36 36 0 1 0 128 176 A36 36 0 1 0 128 104 Z"/></g>`;

const lockup = (sym, name) =>
  svg(1000, `<g transform="translate(8 32) scale(0.75)">${sym}</g>${word(250, 168, 132, false)}`, `Teampot ${name} lockup`);

const o = "concepts/";
writeFileSync(o + "a-symbol.svg", svg(256, aBody, "Teampot concept A"));
writeFileSync(o + "b-symbol.svg", svg(256, bBody, "Teampot concept B"));
writeFileSync(o + "c-symbol.svg", svg(256, cBody, "Teampot concept C"));
writeFileSync(o + "a-lockup.svg", lockup(aBody, "A"));
writeFileSync(o + "b-lockup.svg", lockup(bBody, "B"));
writeFileSync(o + "c-lockup.svg", svg(1000, word(60, 172, 180), "Teampot C wordmark"));
console.log("ok");
