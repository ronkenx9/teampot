import { chromium } from 'playwright'
const out = '/Users/gadgetplug/Documents/vibecoding/teampot/submission/video/film/assets'
const b = await chromium.launch()
async function shot(v, name, fn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'reduce' }); const p = await ctx.newPage()
  await p.goto('http://localhost:8787/app', { waitUntil: 'networkidle' })
  await p.evaluate(async (v) => { localStorage.setItem('tp-viewer', v); await fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: v }) }) }, v)
  await p.reload({ waitUntil: 'networkidle' }); await p.locator('.role-layout').waitFor(); await p.waitForTimeout(1200)
  if (fn) await fn(p)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/s-${name}.png` })
  await ctx.close()
}
await shot('sam', 'sam-home')
await shot('sam', 'sam-pay', async (p) => { await p.locator('.vbtn', { hasText: 'Pay' }).click(); await p.waitForTimeout(600) })
await shot('sam', 'sam-send', async (p) => { await p.locator('.vbtn', { hasText: 'Send' }).click(); await p.getByText('Ava Chen').first().waitFor() })
await shot('sam', 'sam-visa', async (p) => { await p.locator('.bottom-tabs button', { hasText: 'Spend' }).click(); await p.waitForTimeout(500); await p.locator('.visa-face').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -120)) })
await shot('sam', 'sam-invest', async (p) => { await p.locator('.bottom-tabs button', { hasText: 'Invest' }).click() })
await shot('ava', 'ava-home')
await shot('ava', 'ava-team', async (p) => { await p.locator('.bottom-tabs button', { hasText: 'Team' }).click() })
await shot('jordan', 'jordan-home')
await shot('jordan', 'jordan-depts', async (p) => { await p.locator('.bottom-tabs button', { hasText: 'Departments' }).click() })
await shot('mateo', 'mateo-home')
await b.close()
