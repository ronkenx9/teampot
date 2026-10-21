import { chromium } from "/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("pageerror", (e) => console.error("pageerror", e.message)); p.on("console", (m) => m.type() === "error" && console.error(m.text()));
await p.goto("http://127.0.0.1:8778/anim.html?o=c", { waitUntil: "networkidle" }); await p.evaluate(() => window.ready);
mkdirSync("out/c", { recursive: true });
const ts = process.argv[2].split(",").map(Number);
for (const t of ts) { await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `out/c/${t.toFixed(2)}.jpg`, type: "jpeg", quality: 70 }); }
await b.close();
