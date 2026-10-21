// Teampot, how it works: a phone, the API rack and the Tempo machine on one bench.
// node build.mjs [--light]  →  teampot-anatomy(.html|-light.html)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const KIT = "/Users/gadgetplug/.claude/skills/anatomy";
const k = await import(`${KIT}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${KIT}/scripts/inline-kit.mjs`);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 640;
const HEIGHT = 420;

// ---- truth (teampot/app/server/app.ts seed) --------------------------------
const TRUTH = {
  designBudget: 3600, // Design's monthly budget
  cap: 600, // per-person monthly cap on a Design card
  vendors: ["Figma", "Adobe Fonts", "Notion", "Uber Eats"], // Design's approved list
  offList: "PixelVault Stock",
};

// ---- world plan -------------------------------------------------------------
const PLATE = { x: -272, y: -84, w: 566, d: 176, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const DOCK = { x: -252, y: -18, w: 78, d: 48, r: 6 };
const DOCK_H = 8;
const PHONE = { x: -246, y: 10, w: 66, d: 8, r: 3.5 };
const PH_Z0 = DOCK_H;
const PH_Z1 = 146;
const PH_FRONT = PHONE.y + PHONE.d;
const SCR = { x0: -240, x1: -186, z0: 28, z1: 138, r: 5, depth: 1.2 };

const RACK = { x: -132, y: -42, w: 112, d: 82, r: 4 };
const RACK_FRONT = RACK.y + RACK.d;
const UNITS = [
  { z0: 6, z1: 36, name: "api" },
  { z0: 38, z1: 66, name: "store" },
];

const PLINTH = { x: 8, y: -70, w: 262, d: 146, r: 8 };
const PL_H = 8;
const TREASURY = { x: 54, y: -22, r: 30, z1: 112 };
const GLASS = { x: 14, y: -2, w: 11, d: 9, r: 2 };
const GLASS_Z1 = 104;
const DEPTS = [
  { id: "design", x: 140, y: -42 },
  { id: "eng", x: 186, y: -42 },
  { id: "mkt", x: 232, y: -42 },
];
const DEPT_R = 16;
const DEPT_Z1 = 74;
const MAN_Y = -12; // manifold on the plinth top
const RACKC = { x: 112, y: 14, w: 120, d: 44, r: 4 }; // card rack
const RK_Z = PL_H + 8;
const CARDS = [
  { who: "Sam", x: 120 },
  { who: "Ava", x: 150 },
  { who: "Agent", x: 180 },
];
const CARD = { w: 24, d: 2.6, z1: RK_Z + 40 };
const CARD_Y = 30;
const GATE = { x: 116, y: 52, w: 32, d: 3, r: 1, z0: RK_Z, h: 14 };
const DIAL = { x: 214, y: 36, r: 13 };
const FLAG = { x: 104, y: 44 };
const BINS_Y = [-4, 12, 28, 44];
const BIN_X = 256;
const OFF_BIN = { x: 252, y: 84 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(PHONE, 0, PH_Z1), [TREASURY.x, TREASURY.y, TREASURY.z1 + 4]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 42 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const path3 = (pts) => k.pathOf(pts.map(at));

// ---- base plate --------------------------------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge, ticks hanging from its edge
  const strip = { x: -150, y: PLATE.y + PLATE.d - 14, w: 230, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate
  const label = { x: -258, y: PLATE.y + PLATE.d - 20, w: 46, d: 11, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([32, 24, 28].map((w, i) => k.lineOnTop([label.x + 4, label.y + 3 + i * 2.6], [label.x + 4 + w, label.y + 3 + i * 2.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3, label.y + 2.6, 0.8]), at([label.x + label.w - 3, label.y + label.d - 2.6, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---- cables (lie on the plate, rise into ports) -------------------------------
const ROUTE_A = [
  [DOCK.x + DOCK.w + 4.6, 4, 4],
  [DOCK.x + DOCK.w + 10, 6, 1],
  [-150, 12, 1],
  [-140, 12, 1],
  [RACK.x - 3, 8, 3],
  [RACK.x - 1.4, 6, 14],
];
const ROUTE_B = [
  [RACK.x + RACK.w + 1.4, 6, 14],
  [RACK.x + RACK.w + 4, 8, 3],
  [-6, 12, 1],
  [PLINTH.x - 3, 12, 1.6],
  [PLINTH.x - 1.4, 12, 4.5],
];
function cables() {
  const out = [];
  for (const r of [ROUTE_A, ROUTE_B]) {
    out.push(`<path class="tp-cord" d="${path3(r)}"/>`);
  }
  return out.join("");
}

// ---- phone on its dock ---------------------------------------------------------
let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back, backClass) {
  const id = `tp-clip-${clips++}`;
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})"><g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}</g></g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}
function screen() {
  const X = SCR.x0 + 5;
  const W = SCR.x1 - SCR.x0;
  const z = (v) => -v;
  const c = [];
  // status bar + notch
  c.push(`<text class="tp-ui" x="${X}" y="${z(SCR.z1 - 7)}" font-size="3.4">9:41</text>`);
  c.push(`<rect class="tp-ink" x="${SCR.x0 + W / 2 - 7}" y="${z(SCR.z1 - 3)}" width="14" height="4" rx="2"/>`);
  // header
  c.push(`<text class="tp-ui tp-dim" x="${X}" y="${z(SCR.z1 - 16)}" font-size="3.2">SAM · DESIGN CARD</text>`);
  c.push(`<text class="tp-ui tp-big" data-part="left" x="${X}" y="${z(SCR.z1 - 28)}" font-size="10">$435</text>`);
  c.push(`<text class="tp-ui tp-dim" data-part="leftnote" x="${X}" y="${z(SCR.z1 - 34)}" font-size="3">OF $600 / MONTH</text>`);
  // limit bar
  const barZ = SCR.z1 - 40;
  c.push(`<rect class="tp-track" x="${X}" y="${z(barZ)}" width="${W - 10}" height="2.2" rx="1.1"/>`);
  c.push(`<rect class="tp-fill" data-part="bar" x="${X}" y="${z(barZ)}" width="${((W - 10) * 165) / 600}" height="2.2" rx="1.1"/>`);
  // card chips (approved vendors)
  c.push(`<text class="tp-ui tp-dim" x="${X}" y="${z(SCR.z1 - 49)}" font-size="3">APPROVED</text>`);
  TRUTH.vendors.forEach((v, i) => {
    const cx = X + (i % 2) * 22;
    const cz = SCR.z1 - 55 - Math.floor(i / 2) * 7;
    c.push(`<rect class="tp-chip" x="${cx}" y="${z(cz + 2.6)}" width="${v.length > 6 ? 21 : 15}" height="5" rx="2.5"/><text class="tp-ui tp-chipt" x="${cx + 2.4}" y="${z(cz - 0.9)}" font-size="2.7">${v}</text>`);
  });
  // pay sheet
  const sheetZ = SCR.z0 + 37;
  c.push(`<rect class="tp-sheet" x="${SCR.x0 + 2}" y="${z(sheetZ)}" width="${W - 4}" height="${sheetZ - SCR.z0 - 2}" rx="4"/>`);
  c.push(`<text class="tp-ui tp-dim" data-part="to" x="${X}" y="${z(sheetZ - 6.5)}" font-size="3.2">PAY · FIGMA</text>`);
  c.push(`<text class="tp-ui tp-mid" data-part="amount" x="${X}" y="${z(sheetZ - 14.5)}" font-size="7">$45.00</text>`);
  c.push(`<g data-part="button"><rect class="tp-btn" x="${X - 1}" y="${z(SCR.z0 + 15)}" width="${W - 8}" height="7.4" rx="3.7"/><text class="tp-ui tp-btnt" data-part="btntext" x="${SCR.x0 + W / 2}" y="${z(SCR.z0 + 9.6)}" font-size="3.4" text-anchor="middle">Pay with Face ID</text></g>`);
  c.push(`<text class="tp-ui tp-status" data-part="status" x="${SCR.x0 + W / 2}" y="${z(SCR.z0 + 4.4)}" font-size="2.7" text-anchor="middle">Limits enforced by Tempo</text>`);
  // home bar
  c.push(`<rect class="tp-ink" x="${SCR.x0 + W / 2 - 9}" y="${z(SCR.z0 - 3.4)}" width="18" height="1" rx="0.5"/>`);
  return recess(SCR, PH_FRONT, `<g data-part="screen">${c.join("")}</g>`, "tp-glass");
}
function phone() {
  const out = [`<path class="iso-halo" d="${k.haloOf(DOCK, 0, 10, P)}"/>`];
  out.push(S(k.slabOf(DOCK, 0, DOCK_H, P, 6, 1), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(DOCK, 3), DOCK_H, P, 6), { tone: "faint" }));
  out.push(D(k.corners(DOCK, 5).map(([x, y]) => at([x, y, DOCK_H])), { size: 0.45 }));
  // back rest
  const rest = { x: PHONE.x + 8, y: -14, w: PHONE.w - 16, d: 24, r: 3 };
  out.push(S(k.slabOf(rest, DOCK_H, 64, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(rest, 2), DOCK_H + 64, P, 4), { tone: "faint" }));
  // port on the dock's +x face
  out.push(S(k.slabOf({ x: DOCK.x + DOCK.w - 0.4, y: 0, w: 1.2, d: 8, r: 0.8 }, 1.6, 4.8, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: DOCK.x + DOCK.w + 0.8, y: 1.4, w: 3.8, d: 5.2, r: 0.8 }, 2.2, 3.6, P, 3, 0.3), { tone: "mid" }));
  // phone body
  out.push(S(k.slabOf(PHONE, PH_Z0, PH_Z1 - PH_Z0, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(PHONE, PH_Z0 + 3, P, 6), { tone: "faint" }) }));
  // side buttons on +x face
  out.push(S(k.slabOf({ x: PHONE.x + PHONE.w, y: 11, w: 0.8, d: 4, r: 0.4 }, 108, 14, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: PHONE.x + PHONE.w, y: 11, w: 0.8, d: 4, r: 0.4 }, 90, 9, P, 2), { tone: "lo" }));
  out.push(`<g data-part="phone" class="tp-press">${screen()}</g>`);
  // front lip holding the phone
  const lip = { x: PHONE.x - 3, y: PH_FRONT, w: PHONE.w + 6, d: 6, r: 2 };
  out.push(S(k.slabOf(lip, DOCK_H, 12, P, 4, 0.6), { tone: "mid" }));
  out.push(D([at([lip.x + 4, lip.y + 3, DOCK_H + 12]), at([lip.x + lip.w - 4, lip.y + 3, DOCK_H + 12])], { size: 0.45 }));
  return out.join("");
}

// ---- API rack ------------------------------------------------------------------
function frontSlots(x0, x1, z0, z1, pitch) {
  const d = [];
  for (let x = x0; x + 1.4 <= x1; x += pitch) d.push(flat(x, z0, x + 1.4, z1, 0.7, 3));
  return d.join("");
}
function rack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(RACK, 0, 10, P)}"/>`];
  out.push(S(k.slabOf(RACK, 0, 4, P, 4, 0.8), { tone: "lo" }));
  UNITS.forEach((u, i) => {
    const plan = k.insetPlan(RACK, 3);
    out.push(S(k.slabOf(plan, u.z0, u.z1 - u.z0, P, 4, 0.8), { tone: i === 0 ? "hi" : "mid" }));
    const fy = plan.y + plan.d;
    const face = [];
    face.push(`<path class="iso-line" data-tone="faint" d="${frontSlots(plan.x + 8, plan.x + 46, u.z0 + 6, u.z1 - 6, 3.2)}"/>`);
    // drive bays
    for (let b = 0; b < 3; b++) face.push(`<path class="iso-line" data-tone="lo" d="${flat(plan.x + 52 + b * 14, u.z0 + 6, plan.x + 63 + b * 14, u.z1 - 6, 1.2, 3)}"/>`);
    face.push(`<path class="iso-line" data-tone="faint" d="${flat(plan.x + 3, u.z0 + 3, plan.x + plan.w - 3, u.z1 - 3, 2, 4)}"/>`);
    out.push(`<g transform="${planeOf(fy)}">${face.join("")}</g>`);
    out.push(`<g data-part="led-${u.name}" class="tp-led">${D([at([plan.x + plan.w - 8, fy, (u.z0 + u.z1) / 2 + 3]), at([plan.x + plan.w - 8, fy, (u.z0 + u.z1) / 2 - 3])], { size: 0.8, tone: "hi" })}</g>`);
    out.push(D([at([plan.x + 3.5, fy, u.z0 + 3.5]), at([plan.x + plan.w - 3.5, fy, u.z0 + 3.5]), at([plan.x + 3.5, fy, u.z1 - 3.5]), at([plan.x + plan.w - 3.5, fy, u.z1 - 3.5])], { size: 0.45 }));
  });
  out.push(S(k.slabOf(RACK, 67, 3, P, 4, 1), { tone: "mid" }));
  out.push(L(Array.from({ length: 6 }, (_, i) => k.planOutline({ x: RACK.x + 14 + i * 14, y: RACK.y + 14, w: 6, d: RACK.d - 28, r: 3 }, 70, P, 4)).join(""), { tone: "faint" }));
  // rack posts at the front corners
  for (const x of [RACK.x - 1, RACK.x + RACK.w - 3]) out.push(S(k.slabOf({ x, y: RACK_FRONT - 5, w: 4, d: 6, r: 1 }, 0, 72, P, 3, 0.5), { tone: "mid" }));
  // side ports for the cables
  out.push(S(k.slabOf({ x: RACK.x - 2.2, y: 3, w: 1.4, d: 6, r: 0.6 }, 11, 6, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: RACK.x + RACK.w + 0.8, y: 3, w: 1.4, d: 6, r: 0.6 }, 11, 6, P, 3), { tone: "lo" }));
  return out.join("");
}

// ---- Tempo machine ----------------------------------------------------------------
function tank(x, y, r, z0, z1, tone, bands) {
  const out = [];
  out.push(S(k.cylinder(x, y, r + 3, z0, 3, P, 56, 0.6), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, r, z0 + 3, z1 - z0 - 3, P, 64, 0.8), { tone, inner: L(bands.map((b) => k.sideArc(x, y, r, b, P, 40)).join(""), { tone: "faint" }) }));
  out.push(L(k.ring(x, y, r - 3, z1, P, 48), { tone: "faint" }));
  return out.join("");
}
function keyRing(cx, cy, z, angle) {
  // a head admin key: bow + blade, seen from above; rotates about the valve axis
  const c = Math.cos(angle), s = Math.sin(angle);
  const rot = ([u, v]) => [cx + u * c - v * s, cy + u * s + v * c];
  return [[-1.2, -5.5], [1.2, -5.5], [1.2, 5.5], [-1.2, 5.5]].map(rot);
}
function machine() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, 0, 10, P)}"/>`];
  out.push(S(k.slabOf(PLINTH, 0, PL_H, P, 8, 1.2), { tone: "lo", inner: L(k.sideSeam(PLINTH, 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 4), PL_H, P, 8), { tone: "faint" }));
  out.push(D(k.corners(PLINTH, 8).map(([x, y]) => at([x, y, PL_H])), { size: 0.5 }));
  out.push(`<g transform="${planeOf(PLINTH.y + PLINTH.d)}">${k.faceTextSvg("", "TEMPO", { size: 3.2, tone: "lo" }).replace("<text", `<text x="${PLINTH.x + 12}" y="${-2.4}"`)}</g>`);
  // plinth port where the API cable lands
  out.push(S(k.slabOf({ x: PLINTH.x - 1.6, y: 9, w: 1.6, d: 6, r: 0.6 }, 2, 4.5, P, 3), { tone: "mid" }));

  // department tanks (back row), each capped with a valve and its head's key
  const valves = [];
  for (const d of DEPTS) {
    out.push(tank(d.x, d.y, DEPT_R, PL_H, DEPT_Z1, d.id === "design" ? "hi" : "mid", [PL_H + 12, DEPT_Z1 - 8]));
    out.push(`<path class="tp-level" data-part="level-${d.id}" d=""/>`);
    out.push(S(k.cylinder(d.x, d.y, 7, DEPT_Z1, 5, P, 32, 0.5), { tone: "mid" }));
    out.push(L(k.knurl(d.x, d.y, 7, DEPT_Z1, DEPT_Z1 + 5, 28, P, 0.3), { tone: "lo" }));
    out.push(S(k.cylinder(d.x, d.y, 3, DEPT_Z1 + 5, 4, P, 20), { tone: "lo" }));
    valves.push(d);
    out.push(`<g data-part="key-${d.id}" class="${d.id === "design" ? "tp-key tp-press" : ""}">${S(k.extrude(keyRing(d.x, d.y, 0, Math.PI / 4), DEPT_Z1 + 9, 2.2, P), { tone: d.id === "design" ? "hi" : "mid" })}${S(k.cylinder(d.x, d.y, 2.2, DEPT_Z1 + 9, 3, P, 16), { tone: "mid" })}</g>`);
  }
  // manifold on the plinth top: treasury → every department
  const manifold = [[TREASURY.x + TREASURY.r + 2, MAN_Y, PL_H + 1.2], [DEPTS[2].x, MAN_Y, PL_H + 1.2]];
  out.push(`<path class="tp-pipe" d="${path3(manifold)}"/>`);
  for (const d of DEPTS) out.push(`<path class="tp-pipe" d="${path3([[d.x, MAN_Y, PL_H + 1.2], [d.x, d.y + DEPT_R + 3, PL_H + 1.2]])}"/>`);
  out.push(D(DEPTS.map((d) => at([d.x, MAN_Y, PL_H + 1.2])), { size: 0.9, tone: "mid" }));
  // feed from the Design tank to the card rack
  out.push(`<path class="tp-pipe" d="${path3([[DEPTS[0].x - 6, MAN_Y, PL_H + 1.2], [DEPTS[0].x - 6, RACKC.y, PL_H + 1.2]])}"/>`);
  out.push(D([at([DEPTS[0].x - 6, MAN_Y, PL_H + 1.2])], { size: 0.9, tone: "mid" }));
  // request line from the plinth port to the card rack
  out.push(`<path class="tp-pipe" d="${path3([[PLINTH.x + 2, 12, PL_H + 1.2], [RACKC.x - 2, 12, PL_H + 1.2], [RACKC.x - 2, RACKC.y + 6, PL_H + 1.2]])}"/>`);

  // treasury tank + sight glass
  out.push(tank(TREASURY.x, TREASURY.y, TREASURY.r, PL_H, TREASURY.z1, "mid", [PL_H + 16, 60, TREASURY.z1 - 10]));
  out.push(S(k.cylinder(TREASURY.x, TREASURY.y, 9, TREASURY.z1, 5, P, 32, 0.6), { tone: "lo" }));
  out.push(D(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return at([TREASURY.x + Math.cos(a) * (TREASURY.r - 6), TREASURY.y + Math.sin(a) * (TREASURY.r - 6), TREASURY.z1]); }), { size: 0.45 }));
  out.push(`<path class="tp-level" data-part="level-treasury" d=""/>`);
  out.push(S(k.slabOf(GLASS, PL_H, GLASS_Z1 - PL_H, P, 3, 0.6), { tone: "mid" }));
  const gy = GLASS.y + GLASS.d;
  out.push(`<g transform="${planeOf(gy)}"><path class="tp-glassbg" d="${flat(GLASS.x + 2.2, PL_H + 4, GLASS.x + GLASS.w - 2.2, GLASS_Z1 - 4, 1.2, 3)}"/><rect class="tp-fill" data-part="glass" x="${GLASS.x + 2.2}" y="${-(GLASS_Z1 - 4)}" width="${GLASS.w - 4.4}" height="${GLASS_Z1 - PL_H - 8}"/><path class="iso-line" data-tone="lo" d="${flat(GLASS.x + 2.2, PL_H + 4, GLASS.x + GLASS.w - 2.2, GLASS_Z1 - 4, 1.2, 3)}"/></g>`);
  out.push(D([at([GLASS.x + GLASS.w / 2, gy, GLASS_Z1 - 1.6]), at([GLASS.x + GLASS.w / 2, gy, PL_H + 1.6])], { size: 0.45 }));

  // card rack
  out.push(`<path class="iso-halo" d="${k.haloOf(RACKC, PL_H, 6, P)}"/>`);
  out.push(S(k.slabOf(RACKC, PL_H, 8, P, 4, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf({ x: RACKC.x, y: RACKC.y, w: RACKC.w, d: 8, r: 2 }, RK_Z, 30, P, 3, 0.6), { tone: "mid" }));
  for (const c of CARDS) out.push(L(k.planOutline({ x: c.x - 2, y: CARD_Y - 1.4, w: CARD.w + 4, d: CARD.d + 2.8, r: 1 }, RK_Z, P, 3), { tone: "lo" }));
  // held flag
  out.push(S(k.cylinder(FLAG.x + 2, FLAG.y + 2, 3, PL_H, 2, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(FLAG.x + 2, FLAG.y + 2, 1, PL_H + 2, 40, P, 12), { tone: "mid" }));
  out.push(`<g data-part="flag">${S(k.slabOf({ x: FLAG.x + 3, y: FLAG.y + 1.4, w: 12, d: 1.2, r: 0.4 }, PL_H + 18, 8, P, 2), { tone: "mid" })}</g>`);
  // cards
  CARDS.forEach((c, i) => {
    const plan = { x: c.x, y: CARD_Y, w: CARD.w, d: CARD.d, r: 1 };
    const fy = CARD_Y + CARD.d;
    const face = `<g transform="${planeOf(fy)}"><rect class="tp-chipface" x="${c.x + 3}" y="${-(CARD.z1 - 6)}" width="6" height="5" rx="1"/><path class="iso-line" data-tone="faint" d="M${c.x + 3} ${-(RK_Z + 9)}H${c.x + 15}M${c.x + 3} ${-(RK_Z + 6)}H${c.x + 11}"/></g>`;
    out.push(`<g data-part="card-${i}">${S(k.slabOf(plan, RK_Z, CARD.z1 - RK_Z, P, 2, 0.4), { tone: i === 0 ? "hi" : "mid" })}${face}</g>`);
  });
  // limit dial (Sam's card: spent of $600)
  out.push(S(k.cylinder(DIAL.x, DIAL.y, DIAL.r, PL_H + 8, 6, P, 56, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(DIAL.x, DIAL.y, DIAL.r, PL_H + 11, PL_H + 14, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(DIAL.x, DIAL.y, DIAL.r - 2, PL_H + 14, P, 48), { tone: "lo" }));
  const t = k.radialTicks(DIAL.x, DIAL.y, DIAL.r - 2.6, 30, 5, PL_H + 14, [1.1, 2.4], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(`<path class="tp-needle" data-part="needle" d=""/>`);
  out.push(D([at([DIAL.x, DIAL.y, PL_H + 14])], { size: 0.9, tone: "hi" }));
  // gate in front of Sam's card
  out.push(S(k.slabOf({ x: GATE.x - 4, y: GATE.y - 1, w: 3, d: 5, r: 0.6 }, GATE.z0, 30, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: GATE.x + GATE.w + 1, y: GATE.y - 1, w: 3, d: 5, r: 0.6 }, GATE.z0, 30, P, 2), { tone: "mid" }));
  out.push(`<g data-part="gate">${S(k.slabOf(GATE, GATE.z0, GATE.h, P, 2, 0.4), { tone: "mid" })}</g>`);
  // vendor bins: the approved list, and the off-list one on the bench
  BINS_Y.forEach((y) => {
    out.push(S(k.cylinder(BIN_X, y, 6.4, PL_H, 7, P, 32, 0.4), { tone: "mid" }));
    out.push(L(k.ring(BIN_X, y, 4.6, PL_H + 7, P, 24), { tone: "lo" }));
  });
  out.push(S(k.cylinder(OFF_BIN.x, OFF_BIN.y, 6.4, 0, 7, P, 32, 0.4), { tone: "lo" }));
  out.push(L(k.ring(OFF_BIN.x, OFF_BIN.y, 4.6, 7, P, 24), { tone: "faint" }));
  // the payment coin, built at the card and moved along its path
  out.push(`<g data-part="coin" style="opacity:0">${S(k.cylinder(CARDS[0].x + CARD.w / 2, GATE.y + 2, 4.6, RK_Z, 1.8, P, 28, 0.4), { lit: true })}</g>`);
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Teampot drawn as a workbench: a phone on a dock running the Teampot app, cabled to a two-unit API rack, cabled to a machine labelled Tempo. On the machine a treasury tank feeds three department tanks through a manifold; each department tank is capped by a valve turned by its head's key. The Design tank feeds a card rack with Sam's, Ava's and an agent's cards, a gate, a limit dial and a held flag, with vendor bins beyond.",
  body: [plate(), cables(), phone(), rack(), machine(), `<g data-part="pulses"><circle class="tp-pulse" data-part="pulse" r="3.4" cx="0" cy="0" style="opacity:0"/></g>`],
});

// screen-space routes for the pulse
const routes = {
  a: ROUTE_A.map(at),
  b: ROUTE_B.map(at),
  c: [[PLINTH.x + 2, 12, PL_H + 1.2], [RACKC.x - 2, 12, PL_H + 1.2], [RACKC.x - 2, RACKC.y + 6, PL_H + 1.2]].map(at),
  fund: [[TREASURY.x + TREASURY.r + 2, MAN_Y, PL_H + 1.2], [DEPTS[0].x, MAN_Y, PL_H + 1.2], [DEPTS[0].x, DEPTS[0].y + DEPT_R + 3, PL_H + 1.2]].map(at),
  head: [[DEPTS[0].x, DEPTS[0].y, DEPT_Z1 + 9], [DEPTS[0].x - 6, MAN_Y, PL_H + 1.2], [DEPTS[0].x - 6, RACKC.y, PL_H + 1.2]].map(at),
};
const coinPaths = {
  pass: [[0, 0, 0], [0, 6, 0], [BIN_X - (CARDS[0].x + CARD.w / 2), 6, -6 + 4], [BIN_X - (CARDS[0].x + CARD.w / 2), BINS_Y[0] - (GATE.y + 2), 4]],
  off: [[0, 0, 0], [0, 6, 0], [OFF_BIN.x - (CARDS[0].x + CARD.w / 2), OFF_BIN.y - (GATE.y + 2), -RK_Z + 6]],
};

const live = `
const P = ${JSON.stringify(P)};
const T = ${JSON.stringify(TRUTH)};
const ROUTES = ${JSON.stringify(routes)};
const COIN = ${JSON.stringify(coinPaths)};
const G = ${JSON.stringify({ TREASURY, GLASS, GLASS_Z1, PL_H, DEPT: DEPTS[0], DEPT_R, DEPT_Z1, DIAL, GATE })};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (n) => svg.querySelector('[data-part="' + n + '"]');
const el = { card: $("card-0"), pulse: $("pulse"), gate: $("gate"), flag: $("flag"), coin: $("coin"), needle: $("needle"), key: $("key-design"),
  ledApi: $("led-api"), ledStore: $("led-store"), lvT: $("level-treasury"), lvD: $("level-design"), glass: $("glass"),
  left: $("left"), leftnote: $("leftnote"), bar: $("bar"), to: $("to"), amount: $("amount"), btn: $("btntext"), status: $("status"), button: $("button") };
const readout = document.querySelector("[data-readout]");
const live = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const buttons = [...document.querySelectorAll("[data-act]")];

// model (true seed numbers)
const m = { spent: 165, budget: 3600 - 165, treasury: 0.72, held: false, gate: 0, flag: 0, keyA: Math.PI / 4, needle: 165 };
const shown = { needle: 165, treasury: 0.72, design: (3600 - 165) / 5000, gate: 0, flag: 0, keyA: Math.PI / 4 };
let job = null, frame = 0, last = 0, visible = false, touring = !still.matches, idle = 0, tourStep = 0, tourWait = 1.4;

function along(pts, u) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1, d / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } d -= seg[i]; }
  return pts[pts.length - 1];
}
function along3(pts, u) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); total += l; }
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1, d / seg[i]) : 0; return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * t); } d -= seg[i]; }
  return pts[pts.length - 1];
}
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

function screenText(o) {
  for (const [key, v] of Object.entries(o)) if (el[key] && el[key].textContent !== v) el[key].textContent = v;
}
function say(text) { if (readout.textContent !== text) readout.textContent = text; }
function announce(text) { live.textContent = text; }
function syncPhone() {
  const left = Math.max(0, T.cap - m.spent);
  screenText({ left: money(left), leftnote: "OF $600 / MONTH" });
  el.bar.setAttribute("width", String((${SCR.x1 - SCR.x0 - 10} * Math.min(m.spent, T.cap)) / T.cap));
}

// jobs: a timeline of phases driven by one clock
const JOBS = {
  figma: { label: "Pay Figma $45", to: "PAY · FIGMA", amount: "$45.00", allowed: true },
  pixel: { label: "Pay PixelVault $45", to: "PAY · PIXELVAULT", amount: "$45.00", allowed: false },
};
function start(kind) {
  if (job) return;
  if (kind === "approve" && !m.held) { say("Nothing is held · try PixelVault first"); return; }
  job = { kind, t: 0 };
  if (kind === "figma" || kind === "pixel") {
    const j = JOBS[kind];
    if (m.held && kind === "figma") {}
    screenText({ to: j.to, amount: j.amount, btn: "Face ID…", status: "Signing with passkey" });
    el.button.setAttribute("data-on", "");
    say("Sam pays · signed on the phone");
  } else if (kind === "approve") {
    screenText({ btn: "Waiting for Ava", status: "Ava signs with her key" });
    say("Ava turns the Design head key");
  } else if (kind === "fund") {
    screenText({ status: "Finance funds Design" });
    say("Finance funds Design · treasury → department account");
  }
  buttons.forEach((b) => b.toggleAttribute("disabled", true));
  run();
}
function finish(text, status) {
  job = null;
  el.button.removeAttribute("data-on");
  buttons.forEach((b) => b.toggleAttribute("disabled", false));
  if (status) announce(status);
  say(text);
}
function pulseAt(route, u, on) {
  if (!on) { el.pulse.style.opacity = "0"; return; }
  const [x, y] = along(ROUTES[route], u);
  el.pulse.setAttribute("cx", x.toFixed(1)); el.pulse.setAttribute("cy", y.toFixed(1));
  el.pulse.style.opacity = "1";
}
function coinAt(path, u, on) {
  el.coin.style.opacity = on ? "1" : "0";
  if (!on) return;
  const p = along3(COIN[path], ease(u));
  el.coin.setAttribute("transform", translateAlong(P, p));
}
function blink(led, on) { led.toggleAttribute("data-on", on); }

function stepJob(dt) {
  const j = job; j.t += dt; const t = j.t;
  if (j.kind === "figma" || j.kind === "pixel") {
    const ok = JOBS[j.kind].allowed;
    if (t < 0.5) pulseAt("a", 0, false);
    else if (t < 1.2) pulseAt("a", (t - 0.5) / 0.7, true);
    else if (t < 1.5) { pulseAt("a", 1, false); }
    else if (t < 2.1) pulseAt("b", (t - 1.5) / 0.6, true);
    else if (t < 2.6) pulseAt("c", (t - 2.1) / 0.5, true);
    else pulseAt("c", 1, false);
    blink(el.ledApi, t > 1.15 && t < 1.55);
    blink(el.ledStore, t > 1.3 && t < 1.5);
    el.card.toggleAttribute("data-on", t > 2.5 && t < (ok ? 3.9 : 3.6));
    if (t > 1.2 && t < 1.25) screenText({ status: "API verifies · relays" });
    if (t > 2.1 && t < 2.15) screenText({ status: "Tempo checks the rules" });
    if (ok) {
      if (t > 2.6) m.gate = 1;
      coinAt("pass", (t - 2.8) / 0.9, t > 2.8 && t < 3.9);
      if (t > 3.3 && !j.paid) { j.paid = true; m.spent += 45; m.budget -= 45; syncPhone(); screenText({ btn: "Paid ✓", status: "Paid on Tempo · ~1 s" }); }
      if (t > 3.9) m.gate = 0;
      if (t > 4.6) finish("Paid Figma $45 · " + money(T.cap - m.spent) + " left on Sam's card", "Paid. Figma is on Design's list and under the cap.");
    } else {
      if (t > 2.6 && !j.held) { j.held = true; m.held = true; m.flag = 1; screenText({ btn: "Held for Ava", status: "Refused by Tempo" }); }
      if (t > 3.6) finish("Refused by Tempo · PixelVault isn't on Design's list · held for Ava", "Refused on chain. The payment waits for Ava.");
    }
  } else if (j.kind === "approve") {
    m.keyA = Math.PI / 4 + ease(t / 0.7) * (Math.PI / 2);
    if (t > 0.7 && t < 1.5) pulseAt("head", (t - 0.7) / 0.8, true); else pulseAt("head", 1, false);
    if (t > 1.5) { m.flag = 0; m.gate = 1; }
    coinAt("off", (t - 1.7) / 1.0, t > 1.7 && t < 2.9);
    if (t > 2.3 && !j.paid) { j.paid = true; m.held = false; m.budget -= 45; screenText({ btn: "Approved ✓", status: "Paid from Design" }); }
    if (t > 2.9) { m.gate = 0; m.keyA = Math.PI / 4 + Math.PI / 2 * (1 - ease((t - 2.9) / 0.6)); }
    if (t > 3.6) finish("Ava approved PixelVault $45 · paid from Design's account", "Approved. Ava's head key signed it.");
  } else if (j.kind === "fund") {
    if (t > 0.3 && t < 1.6) pulseAt("fund", (t - 0.3) / 1.3, true); else pulseAt("fund", 1, false);
    if (t > 0.6 && !j.moved) { j.moved = true; m.treasury = Math.max(0.2, m.treasury - 0.12); m.budget += 1000; }
    if (t > 2.2) finish("Finance moved $1,000 to Design · " + money(m.budget) + " in Design", "Design topped up from the treasury.");
  }
}

function needlePath(v) {
  const a = -Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, v / T.cap);
  const r = G.DIAL.r - 4, z = G.PL_H + 14.2;
  const tip = [G.DIAL.x + Math.sin(a) * r, G.DIAL.y - Math.cos(a) * r];
  const tail = [G.DIAL.x - Math.sin(a) * 3, G.DIAL.y + Math.cos(a) * 3];
  return lineOnTop(tail, tip, z, P);
}
function levelArc(x, y, r, z) { return sideArc(x, y, r, z, P, 40); }
function keyRing(cx, cy, a) { const c = Math.cos(a), s = Math.sin(a); return [[-1.2, -5.5], [1.2, -5.5], [1.2, 5.5], [-1.2, 5.5]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]); }
let keyDrawn = null;
function draw(dt, calm) {
  const f = (cur, tgt, tau) => calm ? tgt : cur + (tgt - cur) * (1 - Math.exp(-dt / tau));
  shown.needle = f(shown.needle, m.spent, 0.35);
  shown.treasury = f(shown.treasury, m.treasury, 0.5);
  shown.design = f(shown.design, m.budget / 5000, 0.5);
  shown.gate = f(shown.gate, m.gate, 0.12);
  shown.flag = f(shown.flag, m.flag, 0.15);
  shown.keyA = m.keyA;
  el.needle.setAttribute("d", needlePath(shown.needle));
  const zT = G.PL_H + 6 + (G.TREASURY.z1 - G.PL_H - 12) * shown.treasury;
  el.lvT.setAttribute("d", levelArc(G.TREASURY.x, G.TREASURY.y, G.TREASURY.r, zT));
  const zD = G.PL_H + 6 + (G.DEPT_Z1 - G.PL_H - 12) * Math.min(1, shown.design);
  el.lvD.setAttribute("d", levelArc(G.DEPT.x, G.DEPT.y, G.DEPT_R, zD));
  const gh = (G.GLASS_Z1 - G.PL_H - 8) * shown.treasury;
  el.glass.setAttribute("y", String(-(G.PL_H + 4 + gh))); el.glass.setAttribute("height", String(gh));
  el.gate.setAttribute("transform", translateAlong(P, [0, 0, 12 * shown.gate]));
  el.flag.setAttribute("transform", translateAlong(P, [0, 0, 16 * shown.flag]));
  el.flag.toggleAttribute("data-on", m.held);
  if (keyDrawn !== shown.keyA) {
    keyDrawn = shown.keyA;
    el.key.innerHTML = solidSvg(extrude(keyRing(G.DEPT.x, G.DEPT.y, shown.keyA), G.DEPT_Z1 + 9, 2.2, P), { tone: "hi", lit: !!job && job.kind === "approve" }) + solidSvg(cylinder(G.DEPT.x, G.DEPT.y, 2.2, G.DEPT_Z1 + 9, 3, P, 16), { tone: "mid" });
  }
  return Math.abs(shown.needle - m.spent) < 0.05 && Math.abs(shown.treasury - m.treasury) < 1e-3 && Math.abs(shown.design - m.budget / 5000) < 1e-3 && Math.abs(shown.gate - m.gate) < 1e-3 && Math.abs(shown.flag - m.flag) < 1e-3;
}

const TOUR = ["figma", "pixel", "approve", "fund"];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (job) stepJob(calm ? 10 : dt);
  else if (touring) { tourWait -= dt; if (tourWait <= 0) { const kind = TOUR[tourStep % TOUR.length]; tourStep++; tourWait = 2.2; if (kind === "fund" && m.budget > 4200) { m.budget = 3600 - 165; m.spent = 165; m.treasury = 0.72; syncPhone(); } start(kind); } }
  const settled = draw(dt, calm);
  frame = visible && (job || touring || !settled) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
function takeOver() { touring = false; clearTimeout(idle); idle = setTimeout(() => { if (!still.matches) { touring = true; tourWait = 1; run(); } }, 9000); }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
buttons.forEach((b) => b.addEventListener("click", () => { takeOver(); start(b.dataset.act); }));
svg.addEventListener("click", (e) => {
  if (e.target.closest('[data-part="phone"]')) { takeOver(); start(m.held ? "approve" : "figma"); }
  else if (e.target.closest('[data-part="key-design"]')) { takeOver(); start("approve"); }
});
stage.addEventListener("keydown", (e) => {
  const map = { "1": "figma", "2": "pixel", "3": "approve", "4": "fund" };
  if (map[e.key]) { e.preventDefault(); takeOver(); start(map[e.key]); }
});
syncPhone();
draw(1, true);
say("Sam's Design card · " + money(T.cap - m.spent) + " of $600 left");
`;

const css = `<style>
.tp-cord{fill:none;stroke:var(--anatomy-lo);stroke-width:1.6px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.tp-pipe{fill:none;stroke:var(--anatomy-mid);stroke-width:1.8px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.tp-level{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2px;vector-effect:non-scaling-stroke}
.tp-needle{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2px;vector-effect:non-scaling-stroke;stroke-linecap:round}
.tp-pulse{fill:var(--anatomy-lit);filter:drop-shadow(0 0 2px var(--anatomy-lit))}
.tp-glass{fill:var(--anatomy-shade-0)}
.tp-glassbg{fill:var(--anatomy-shade-1)}
.tp-fill{fill:var(--anatomy-lit);opacity:.85}
.tp-track{fill:var(--anatomy-faint)}
.tp-ui{fill:var(--anatomy-hi);font-family:var(--anatomy-sans,system-ui);letter-spacing:.01em}
.tp-dim{fill:var(--anatomy-muted);font-family:var(--anatomy-mono);letter-spacing:.08em}
.tp-big{font-weight:600;fill:var(--anatomy-lit);letter-spacing:-.02em}
.tp-mid{font-weight:600}
.tp-ink{fill:var(--anatomy-lo)}
.tp-chip{fill:none;stroke:var(--anatomy-lo);stroke-width:.5px;vector-effect:non-scaling-stroke}
.tp-chipt{fill:var(--anatomy-mid)}
.tp-chipface{fill:none;stroke:var(--anatomy-lo);stroke-width:.6px;vector-effect:non-scaling-stroke}
.tp-sheet{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:.5px;vector-effect:non-scaling-stroke}
.tp-btn{fill:var(--anatomy-hi)}
.tp-btnt{fill:var(--anatomy-shade-0);font-weight:600}
[data-part="button"][data-on] .tp-btn{fill:var(--anatomy-lit)}
.tp-status{fill:var(--anatomy-muted)}
.tp-led [data-part],.tp-led circle{transition:opacity .15s}
.tp-led{opacity:.35;transition:opacity .12s}
.tp-led[data-on]{opacity:1}
[data-part="flag"][data-on] .iso-top{fill:var(--anatomy-lit-shade)}
[data-part="flag"][data-on] .iso-edge{stroke:var(--anatomy-lit)}
.tp-press{cursor:pointer}
[data-part="card-0"][data-on] .iso-edge{stroke:var(--anatomy-lit)}
[data-part="card-0"][data-on] .iso-top{fill:var(--anatomy-lit-shade)}
[data-part="key-design"]:hover .iso-edge{stroke:var(--anatomy-lit)}
.tp-controls{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
.tp-controls button{font:500 12px/1 var(--anatomy-mono);letter-spacing:.04em;color:var(--anatomy-hi);background:transparent;border:1px solid var(--anatomy-faint);border-radius:999px;padding:8px 12px;cursor:pointer}
.tp-controls button:hover{border-color:var(--anatomy-mid)}
.tp-controls button:disabled{opacity:.4;cursor:default}
.tp-controls kbd{font:inherit;color:var(--anatomy-muted);margin-right:6px}
.tp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.iso-stage{touch-action:pan-y}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const controls = `<div class="tp-controls" role="group" aria-label="Run a payment">
<button data-act="figma"><kbd>1</kbd>Sam pays Figma $45</button>
<button data-act="pixel"><kbd>2</kbd>Sam pays PixelVault $45</button>
<button data-act="approve"><kbd>3</kbd>Ava approves</button>
<button data-act="fund"><kbd>4</kbd>Finance funds Design</button>
</div>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "Teampot, how it works",
    hint: "Press a payment · tap the phone or Ava's key",
    readout: "Sam's Design card · $435 of $600 left",
    keys: [
      { mark: "lit", label: "The payment as it travels, and what Tempo decides" },
      { mark: "raised", label: "Phone, API rack and the Tempo machine on one bench" },
      { mark: "edge", label: "Cables carry the signed request; pipes carry the money" },
    ],
    caption:
      "Sam's phone signs the payment with a passkey (Face ID). The API rack checks the signature, keeps the app's records and relays the signed transaction to Tempo. On Tempo the company treasury funds each department as its own account, and the head of Design, Ava, issued Sam's card as a key on that account: $600 a month, only to Design's approved vendors (Figma, Adobe Fonts, Notion, Uber Eats). The chain itself enforces both. A payment inside the rules goes through in about a second; one outside them is refused on chain and waits as a request until Ava approves it with her own head key. Design's budget is $3,600 a month; the figures come from Teampot's demo company.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Teampot payment flow. Keys 1 to 4 run: Sam pays Figma, Sam pays PixelVault, Ava approves, Finance funds Design.">${svg}<span class="tp-sr" role="status" aria-live="polite" data-status></span></div>${controls}`,
  });

const name = theme === "light" ? "teampot-anatomy-light.html" : "teampot-anatomy.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Teampot, how it works", theme, body, script: kitScript() + live, width: 700 }));
console.log("wrote", name);
