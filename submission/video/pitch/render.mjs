// node render.mjs preview 1,2,3   |   node render.mjs frames <fps> <workers>
import { chromium } from '/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
const URL = 'http://127.0.0.1:8765/pitch/pitch.html'
const [mode, arg, wArg] = process.argv.slice(2)
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const open = async () => { const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto(URL, { waitUntil: 'networkidle' }); await p.evaluate(() => window.ready); return p }
if (mode === 'preview') {
  mkdirSync('out/preview', { recursive: true }); const p = await open()
  for (const t of arg.split(',').map(Number)) { await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `out/preview/t${t.toFixed(2).padStart(7, '0')}.jpg`, type: 'jpeg', quality: 80 }) }
} else {
  const fps = Number(arg || 60), workers = Number(wArg || 6); mkdirSync('out/frames', { recursive: true })
  const first = await open(); const dur = await first.evaluate(() => window.VDUR); const total = Math.round(dur * fps), chunk = Math.ceil(total / workers), t0 = Date.now()
  const pages = [first]; for (let w = 1; w < workers; w++) pages.push(await open())
  await Promise.all(Array.from({ length: workers }, async (_, w) => { const p = pages[w]
    for (let i = w * chunk; i < Math.min(total, (w + 1) * chunk); i++) { await p.evaluate((t) => window.seek(t), i / fps); await p.screenshot({ path: `out/frames/${String(i).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 92 }) } }))
  console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await b.close()
