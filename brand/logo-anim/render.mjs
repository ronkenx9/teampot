// node render.mjs sheet  |  node render.mjs video <opt>
import { chromium } from "/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [mode, opt] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("pageerror", (e) => console.error("pageerror", e.message));
await p.goto("http://127.0.0.1:8778/anim.html", { waitUntil: "networkidle" });
await p.evaluate(() => window.ready);
if (mode === "sheet") {
  mkdirSync("out/sheet", { recursive: true });
  for (const o of ["a", "b", "c", "d", "e"]) {
    await p.evaluate((o) => window.pick(o), o);
    const dur = await p.evaluate(() => window.VDUR);
    for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 1]) { const t = f * dur; await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `out/sheet/${o}-${f}.jpg`, type: "jpeg", quality: 70 }); }
  }
} else {
  const fps = 60; await p.evaluate((o) => window.pick(o), opt);
  const dur = await p.evaluate(() => window.VDUR); const dir = `out/frames-${opt}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < Math.round(dur * fps); i++) { await p.evaluate((t) => window.seek(t), i / fps); await p.screenshot({ path: `${dir}/${String(i).padStart(4, "0")}.png` }); }
  execFileSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `out/teampot-logo-${opt}.mp4`]);
  console.log("wrote", opt);
}
await b.close();
