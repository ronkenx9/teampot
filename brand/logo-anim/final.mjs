// 240 fps frames -> tmix motion blur -> 60 fps, with the SFX mixed on their cues
import { chromium } from "/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const opt = process.argv[2] || "c", FPS = 240, W = 6, dir = `out/f240-${opt}`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const open = async () => { const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto(`http://127.0.0.1:8778/anim.html?o=${opt}&clean=1`, { waitUntil: "networkidle" }); await p.evaluate(() => window.ready); return p; };
const pages = []; for (let i = 0; i < W; i++) pages.push(await open());
const dur = await pages[0].evaluate(() => window.VDUR); const total = Math.round(dur * FPS), chunk = Math.ceil(total / W), t0 = Date.now();
await Promise.all(pages.map(async (p, w) => { for (let i = w * chunk; i < Math.min(total, (w + 1) * chunk); i++) { await p.evaluate((t) => window.seek(t), i / FPS); await p.screenshot({ path: `${dir}/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 94 }); } }));
console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await b.close();
const cues = [["roll",0,.5],["thud",1.15,.6],["slash",1.48,.95],["splat",1.53,.6],["whooshup",1.6,.5],
 ...[0,1,2,3,4].flatMap(k=>[["boing",2.05+k*.3,.35],["plop",2.63+k*.3,.5]]),
 ["clank",4.26,.7],["hiss",4.05,.55],["rattle",4.45,.45],["whistle",4.95,.5],["pop",5.6,.95],["whooshup",5.62,.6],
 ["fallwhistle",6.2,.6],["scoot",6.6,.5],["catch",7.0,.75],["slideback",7.5,.4],["chime",8.4,.6]];
const args = ["-y","-v","error","-framerate",String(FPS),"-i",`${dir}/%05d.jpg`];
cues.forEach(([n]) => args.push("-i", `sfx/${n}.mp3`));
const f = cues.map(([n,t,v],i)=>`[${i+1}:a]volume=${v},adelay=${Math.round(t*1000)}|${Math.round(t*1000)}[s${i}]`);
f.push(`${cues.map((_,i)=>`[s${i}]`).join("")}amix=inputs=${cues.length}:normalize=0,apad,atrim=0:${dur},alimiter=limit=0.95,loudnorm=I=-15:TP=-1[a]`);
f.push(`[0:v]tmix=frames=4:weights='1 1 1 1',fps=60,format=yuv420p[v]`);
args.push("-filter_complex", f.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", `out/teampot-logo-${opt}-final.mp4`);
execFileSync("ffmpeg", args); console.log("wrote", `out/teampot-logo-${opt}-final.mp4`);
