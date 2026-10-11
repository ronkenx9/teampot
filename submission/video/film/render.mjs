// Renders film.html frame by frame. Usage:
//   node render.mjs preview 0.8,3.5,6.5,...      → contact sheet frames in out/preview
//   node render.mjs frames <fps> [workers]        → out/frames/%06d.jpg
import { chromium } from '/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/Users/gadgetplug/Documents/vibecoding/teampot/app/.cache/ms-playwright'
const [mode, arg, wArg] = process.argv.slice(2)
const url = pathToFileURL(new URL('./film.html', import.meta.url).pathname).href
const b = await chromium.launch()
async function open() {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.evaluate(() => window.ready)
  return p
}
if (mode === 'preview') {
  mkdirSync('out/preview', { recursive: true })
  const p = await open()
  for (const t of arg.split(',').map(Number)) {
    await p.evaluate((t) => window.seek(t), t)
    await p.screenshot({ path: `out/preview/t${String(t.toFixed(2)).padStart(7, '0')}.jpg`, type: 'jpeg', quality: 80 })
  }
} else {
  const fps = Number(arg || 60), workers = Number(wArg || 4)
  mkdirSync('out/frames', { recursive: true })
  const first = await open()
  const dur = await first.evaluate(() => window.DURATION)
  const { writeFileSync } = await import('node:fs')
  writeFileSync('out/cues.json', JSON.stringify(await first.evaluate(() => window.CUES)))
  const total = Math.round(dur * fps)
  const chunk = Math.ceil(total / workers)
  const t0 = Date.now()
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const p = await open()
    for (let i = w * chunk; i < Math.min(total, (w + 1) * chunk); i++) {
      await p.evaluate((t) => window.seek(t), i / fps)
      await p.screenshot({ path: `out/frames/${String(i).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 93 })
      if (w === 0 && i % 300 === 0) console.log(`frame ${i}/${chunk} of worker 0 · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }))
  console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await b.close()
