import { chromium } from 'playwright'
const b = await chromium.launch(); const out = process.env.OUT || '/tmp/tp-shots/v4'
async function shot(v, tab, vp, name, after) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion:'reduce', deviceScaleFactor: Number(process.env.DPR||1) }); const p = await ctx.newPage()
  await p.goto((process.env.BASE||'http://localhost:8787') + '/app', { waitUntil: 'networkidle' })
  await p.evaluate(async (v) => { localStorage.setItem('tp-viewer', v); await fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: v }) }) }, v)
  await p.reload({ waitUntil: 'networkidle' }); await p.locator('.role-layout').waitFor()
  const nav = vp.width < 900 ? '.bottom-tabs' : '.side-nav nav'
  if (tab) await p.locator(`${nav} button`, { hasText: tab }).first().click()
  await p.waitForTimeout(900)
  if (after) await after(p)
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: !process.env.VIEWPORT_ONLY, animations: 'disabled' })
  await ctx.close()
}
const m={width:390,height:844}, d={width:1280,height:900}
await shot('sam', null, m, 'm-sam-home')
await shot('sam', null, m, 'm-sam-pay', async p => { await p.locator('.next .round-btn').first().click(); await p.waitForTimeout(500) })
await shot('ava', null, m, 'm-ava-home')
await shot('jordan', null, m, 'm-jordan-home')
await shot('mateo', null, m, 'm-mateo-home')
await shot('jordan', 'Departments', m, 'm-jordan-depts')
await shot('sam', 'Invest', m, 'm-sam-invest')
await shot('jordan', 'Departments', d, 'd-jordan-depts')
await b.close()
