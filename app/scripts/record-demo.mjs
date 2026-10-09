// Records a walkthrough of the real app (local server, Tempo testnet) as video footage for the demo.
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:8787'
const OUT = process.env.OUT || '../submission/footage'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } })
const p = await ctx.newPage()
const wait = (ms) => p.waitForTimeout(ms)
const tab = async (who) => { await p.evaluate((x) => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes(x))?.click(), who); await wait(2500) }
const nav = async (label) => { await p.locator('nav.finance-nav button', { hasText: label }).first().click(); await wait(2000) }
const btn = (name) => p.getByRole('button', { name, exact: false }).first()
const log = (m) => console.log(new Date().toISOString().slice(11, 19), m)

log('landing'); await p.goto(BASE + '/'); await wait(3500)
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 450); await wait(700) }
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(1500)
log('open demo'); await p.getByRole('link', { name: /Open the live demo/i }).first().click(); await wait(4500)
log('departments'); await nav('Departments'); await wait(1500); await nav('Overview')

log('sam pays figma'); await tab('Sam')
await p.locator('select').first().selectOption({ label: 'Figma · Software' }).catch(() => {})
await p.getByLabel('Amount').first().fill('45'); await wait(600)
await btn('Pay $45').click(); await wait(1200); await btn('Confirm').click(); await wait(6000)
log('sam pays off-list'); await p.locator('select').first().selectOption({ label: 'PixelVault Stock · Assets' }); await wait(800)
await p.getByLabel('Amount').first().fill('120'); await wait(800)
await btn('Pay $120').click(); await wait(1200); await btn('Confirm').click(); await wait(6000)

log('ava approves'); await tab('Ava'); await wait(1500)
await p.getByRole('button', { name: 'Approve', exact: true }).first().click(); await wait(6500)

log('payday'); await tab('Jordan'); await nav('Payday')
await btn('Preview payday').click(); await wait(1800); await btn('Run payday').click(); await wait(8000)
await btn('Done').click().catch(() => {}); await wait(1200)

log('contractor'); await tab('Mateo'); await wait(1000)
await btn('Send invoice').click(); await wait(4000)
await tab('Jordan'); await nav('Contractors'); await btn('Approve & pay').click(); await wait(6500)

log('activity + receipt'); await nav('Activity'); await wait(2500)
const href = await p.locator('a', { hasText: 'Receipt' }).first().getAttribute('href').catch(() => null)
if (href) { await p.goto(href); await wait(7000) }
await ctx.close(); await b.close()
log('done')
