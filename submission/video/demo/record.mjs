// Records each demo scene from the LIVE app (real testnet actions) via the Chrome screencast.
// Usage: node record.mjs [scene ...]   → clips/<scene>/frames + times.json
import { chromium } from '/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
const BASE = process.env.BASE || 'https://teampot.vercel.app'
const only = process.argv.slice(2)
const b = await chromium.launch()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(viewer) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await p.evaluate(async (v) => { localStorage.setItem('tp-viewer', v); await fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: v }) }) }, viewer)
  await p.reload({ waitUntil: 'networkidle' })
  await p.locator('.role-layout').waitFor({ timeout: 30000 })
  await wait(900)
  return { ctx, p }
}

async function record(name, p, fn) {
  const dir = `clips/${name}`
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const cdp = await p.context().newCDPSession(p)
  const times = []
  let n = 0
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `${String(n++).padStart(5, '0')}.jpg`
    writeFileSync(`${dir}/${file}`, Buffer.from(f.data, 'base64'))
    times.push([file, f.metadata.timestamp])
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })
  // keep frames flowing even when nothing moves
  const tick = setInterval(() => p.evaluate(() => { document.body.dataset.t = String(Date.now()) }).catch(() => {}), 33)
  const t0 = Date.now()
  await wait(400)
  await fn()
  await wait(300)
  clearInterval(tick)
  await cdp.send('Page.stopScreencast')
  await wait(300)
  writeFileSync(`${dir}/times.json`, JSON.stringify({ wall: (Date.now() - t0) / 1000, frames: times }))
  console.log(`${name}: ${times.length} frames, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

const smooth = (p, y, ms = 1200) => p.evaluate(([y, ms]) => new Promise((res) => { const s = scrollY, t0 = performance.now(); const f = (t) => { const u = Math.min(1, (t - t0) / ms), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; scrollTo(0, s + (y - s) * e); u < 1 ? requestAnimationFrame(f) : res() }; requestAnimationFrame(f) }), [y, ms])
const tab = (p, label) => p.locator('.bottom-tabs button', { hasText: label }).click()
const toast = (p, re, timeout = 60000) => p.locator('.toast', { hasText: re }).first().waitFor({ timeout })

const scenes = {
  async home() {
    const { ctx, p } = await open('sam')
    await record('home', p, async () => {
      await wait(1800)
      await p.getByRole('tab', { name: 'Card' }).click(); await wait(2000)
      await p.getByRole('tab', { name: 'Total' }).click(); await wait(900)
      await smooth(p, 430, 1600); await wait(2600); await smooth(p, 0, 1100); await wait(1200)
    })
    await ctx.close()
  },
  async pay() {
    const { ctx, p } = await open('sam')
    await record('pay', p, async () => {
      await wait(500)
      await p.locator('.vbtn', { hasText: 'Pay' }).click(); await wait(900)
      await p.getByRole('radio', { name: 'Figma' }).click(); await wait(350)
      await p.getByLabel('Amount').fill('12'); await wait(600)
      await p.getByRole('button', { name: /^Pay \$12 to Figma/ }).click()
      await p.locator('.stamp', { hasText: 'PAID' }).waitFor({ timeout: 60000 }); await wait(2600)
    })
    await ctx.close()
  },
  async held() {
    const { ctx, p } = await open('sam')
    await record('held', p, async () => {
      await wait(400)
      await p.locator('.vbtn', { hasText: 'Pay' }).click(); await wait(800)
      await p.getByRole('radio', { name: 'PixelVault Stock' }).click(); await wait(500)
      await p.getByLabel('Amount').fill('45'); await wait(500)
      await p.getByRole('button', { name: /^Pay \$45 to PixelVault/ }).click()
      await p.locator('.stamp', { hasText: 'HELD' }).waitFor({ timeout: 60000 }); await wait(2600)
    })
    await ctx.close()
  },
  async approve() {
    const { ctx, p } = await open('ava')
    await record('approve', p, async () => {
      await wait(1000)
      await tab(p, 'Approvals'); await wait(1300)
      await p.locator('.request', { hasText: 'PixelVault' }).first().getByRole('button', { name: 'Approve + add' }).click()
      await toast(p, /Approved and added/); await wait(2200)
    })
    await ctx.close()
  },
  async agent() {
    const { ctx, p } = await open('ava')
    await tab(p, 'Team'); await wait(800)
    await p.locator('.panel', { hasText: 'Agents' }).first().scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -120)); await wait(500)
    await record('agent', p, async () => {
      await wait(700)
      await p.getByRole('button', { name: 'Add agent' }).click(); await wait(1200)
      await p.getByRole('button', { name: 'Give it a card' }).click()
      await p.getByLabel('Agent key').waitFor({ timeout: 90000 }); await wait(1600)
      await p.getByRole('button', { name: 'Done' }).click(); await wait(900)
      await p.locator('.rows li', { hasText: 'Design Bot' }).first().getByRole('button', { name: 'Test purchase' }).click()
      await toast(p, /paid/i, 90000); await wait(1800)
    })
    await ctx.close()
  },
  async finance() {
    const { ctx, p } = await open('jordan')
    await record('finance', p, async () => {
      await wait(1600)
      await tab(p, 'Departments'); await wait(1400)
      await smooth(p, 260, 1000); await wait(700)
      const eng = p.locator('.dept-card', { hasText: 'Engineering' })
      await eng.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -40)); await wait(500)
      await eng.getByRole('button', { name: /Appoint|Change/ }).click(); await wait(500)
      await eng.getByRole('combobox').selectOption({ label: 'Priya Nair' }); await wait(400)
      await eng.getByRole('button', { name: /Make head|Hand over key/ }).click()
      await toast(p, /now holds the Engineering head key/, 90000); await wait(2000)
    })
    await ctx.close()
  },
  async payday() {
    const { ctx, p } = await open('jordan')
    await record('payday', p, async () => {
      await wait(700)
      await p.getByRole('button', { name: 'Review payday' }).first().click(); await wait(1100)
      await p.getByRole('button', { name: 'Run payday' }).click(); await wait(700)
      await p.getByRole('button', { name: /Confirm/ }).click()
      await p.getByText('Payday complete.').waitFor({ timeout: 90000 }); await wait(2400)
    })
    await ctx.close()
  },
  async send() {
    const { ctx, p } = await open('sam')
    await record('send', p, async () => {
      await wait(300)
      await p.locator('.vbtn', { hasText: 'Send' }).click(); await wait(500)
      const h = p.getByLabel('Teampot username'); await h.fill('')
      for (const ch of '@ava') { await h.type(ch); await wait(120) }
      await p.getByText('Ava Chen').first().waitFor(); await wait(500)
      await p.getByLabel('Amount').fill('5'); await wait(400)
      await p.getByRole('button', { name: /^Send \$5 to Ava/ }).click()
      await p.locator('.stamp', { hasText: 'SENT' }).waitFor({ timeout: 60000 }); await wait(1500)
    })
    await ctx.close()
  },
  async invest() {
    const { ctx, p } = await open('sam')
    await tab(p, 'Invest'); await wait(700)
    await record('invest', p, async () => {
      await wait(500)
      await smooth(p, 330, 700)
      await p.locator('.invest-card').getByLabel('Amount').fill('25'); await wait(300)
      await p.locator('.invest-card button', { hasText: /^Buy \$25/ }).click()
      await toast(p, /Bought/); await wait(1500)
    })
    await ctx.close()
  },
  async visa() {
    const { ctx, p } = await open('sam')
    await tab(p, 'Spend'); await wait(600)
    const get = p.getByRole('button', { name: 'Get your Visa card' })
    if (await get.count()) { await get.click(); await toast(p, /Visa card is ready/, 90000); await wait(1200) }
    await p.locator('.visa-face').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -160)); await wait(500)
    await record('visa', p, async () => {
      await wait(600)
      await p.getByRole('button', { name: 'Tap at a shop' }).click(); await wait(900)
      await p.getByRole('radio', { name: /Pret A Manger/ }).click(); await wait(300)
      await p.getByRole('dialog').getByLabel('Amount').fill('14'); await wait(400)
      await p.getByRole('button', { name: /^Tap \$14 at Pret/ }).click()
      await p.getByText('Approved at Pret A Manger').first().waitFor({ timeout: 60000 }); await wait(2200)
    })
    await ctx.close()
  },
  async contractor() {
    const { ctx, p } = await open('mateo')
    await record('contractor', p, async () => {
      await wait(500)
      await p.locator('.vbtn', { hasText: 'Send an invoice' }).click(); await wait(700)
      const d = p.getByRole('dialog'); await d.getByLabel('What for').fill('Launch illustrations'); await d.getByLabel('Amount').fill('640'); await wait(400)
      await d.locator('button', { hasText: /^Send invoice/ }).click(); await wait(1600)
    })
    // Finance pays it off camera, then we show the paid invoice
    const j = await open('jordan')
    const inv = j.p.locator('.rows li', { hasText: 'Launch illustrations' }).first()
    await j.p.getByRole('button', { name: /Approve & pay/ }).first().waitFor({ timeout: 30000 })
    await inv.getByRole('button', { name: /Approve & pay/ }).click(); await j.p.locator('.toast', { hasText: /paid/i }).first().waitFor({ timeout: 60000 })
    await j.ctx.close()
    await p.reload({ waitUntil: 'networkidle' }); await p.locator('.role-layout').waitFor(); await wait(700)
    await record('contractor2', p, async () => {
      await wait(400)
      await tab(p, 'Invoices'); await wait(2600)
    })
    await ctx.close()
  },
}

for (const [name, fn] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue
  try { await fn() } catch (e) { console.log(`${name}: FAILED ${String(e.message).split('\n')[0]}`) }
}
await b.close()
