// Feature audit: drives every feature through the real UI, as each role, against the Tempo testnet.
// Usage: BASE=http://localhost:8790 node scripts/audit-ui.mjs   (starts from whatever state the server has)
import { chromium } from 'playwright'
const BASE = (process.env.BASE || 'http://localhost:8790').replace(/\/$/, '')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= './.cache/ms-playwright'

const results = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

async function as(viewer, tab) {
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.evaluate(async (v) => { localStorage.setItem('tp-viewer', v); await fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: v }) }) }, viewer)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.role-layout').waitFor({ timeout: 20000 })
  if (tab) { await page.locator('.bottom-tabs button', { hasText: tab }).click(); await page.waitForTimeout(500) }
}
const toast = async (re, timeout = 45000) => { await page.locator('.toast', { hasText: re }).first().waitFor({ timeout }); }
async function step(name, fn) {
  const t0 = Date.now()
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }) }
  catch (e) {
    const shown = await page.locator('.toast').allTextContents().catch(() => [])
    results.push({ name, ok: false, ms: Date.now() - t0, err: String(e.message).split('\n')[0].slice(0, 160), toasts: shown.join(' | ').slice(0, 200) })
    await page.keyboard.press('Escape').catch(() => {})
  }
}
const sheetDone = async () => { const d = page.getByRole('button', { name: 'Done' }); if (await d.count()) await d.first().click() }

// ---------- Sam (employee) ----------
await step('Sam: home loads with money card', async () => { await as('sam'); await page.locator('.vault-amt').waitFor() })
await step('Sam: Total/Card toggle switches the card', async () => { await page.getByRole('tab', { name: 'Card' }).click(); await page.locator('.vault-label', { hasText: /card/i }).waitFor({ timeout: 3000 }); await page.getByRole('tab', { name: 'Total' }).click() })
await step('Sam: pay an on-card vendor → PAID', async () => {
  await page.locator('.vbtn', { hasText: 'Pay' }).click()
  await page.getByRole('radio', { name: 'Figma' }).click()
  await page.getByLabel('Amount').fill('5')
  await page.getByRole('button', { name: /^Pay \$5 to Figma/ }).click()
  await page.locator('.stamp', { hasText: 'PAID' }).waitFor({ timeout: 45000 })
  await page.getByRole('link', { name: /public record/i }).waitFor()
  await sheetDone()
})
await step('Sam: pay an off-card vendor → HELD (Tempo refuses)', async () => {
  await page.locator('.vbtn', { hasText: 'Pay' }).click()
  await page.getByRole('radio', { name: 'AWS' }).click()
  await page.getByLabel('Amount').fill('7')
  await page.getByRole('button', { name: /^Pay \$7 to AWS/ }).click()
  await page.locator('.stamp', { hasText: 'HELD' }).waitFor({ timeout: 45000 })
  await sheetDone()
})
await step('Sam: pay over the Finance limit → HELD for Finance', async () => {
  await page.locator('.vbtn', { hasText: 'Pay' }).click()
  await page.getByRole('radio', { name: 'Figma' }).click()
  await page.getByLabel('Amount').fill('1200')
  await page.getByRole('button', { name: /^Pay \$1,200 to Figma/ }).click()
  await page.locator('.stamp', { hasText: 'HELD' }).waitFor({ timeout: 45000 })
  await sheetDone()
})
await step('Sam: invest — buy $20 of a stock', async () => {
  await as('sam', 'Invest')
  await page.locator('.invest-card .segmented button', { hasText: 'Buy' }).click()
  await page.locator('.invest-card').getByLabel('Amount').fill('20')
  await page.locator('.invest-card button', { hasText: /^Buy \$20/ }).click()
  await toast(/Bought/)
})
await step('Sam: invest — sell 0.01 shares', async () => {
  await page.locator('.invest-card .segmented button', { hasText: 'Sell' }).click()
  await page.locator('.invest-card').getByLabel('Shares').fill('0.01')
  await page.locator('.invest-card form button', { hasText: /^Sell$/ }).click()
  await toast(/Sold/)
})
await step('Sam: invest — save "each payday" split', async () => {
  await page.locator('.invest-card .segmented button', { hasText: 'Each payday' }).click()
  await page.locator('.invest-card button', { hasText: /^Save$/ }).click()
  await toast(/Payday investing saved/)
})
await step('Sam: move cash to Earning (simulated)', async () => {
  await page.locator('button', { hasText: 'Move to Earning' }).click()
  await page.waitForTimeout(4000)
  const t = await page.locator('.toast').allTextContents()
  if (t.some((x) => /error|wrong|not/i.test(x))) throw new Error(t.join(' | '))
})
await step('Sam: use the Lunch perk, then go over it (refused by Tempo)', async () => {
  await as('sam', 'Spend')
  await page.locator('button', { hasText: /^Use Lunch/ }).click()
  await toast(/Lunch covered/)
  await page.locator('.perk').first().getByLabel('Amount').fill('50')
  await page.locator('button', { hasText: /^Use Lunch/ }).click()
  await toast(/over your Lunch limit/)
})
await step('Sam: open a receipt from Activity', async () => {
  await as('sam', 'Activity')
  await page.locator('button.feed-row').first().click()
  await page.getByRole('dialog', { name: 'Receipt detail' }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Close' }).click()
})

// ---------- Mateo (contractor) ----------
for (const [amt, what] of [['120', 'Audit illustrations'], ['80', 'Audit draft']]) {
  await step(`Mateo: send invoice $${amt}`, async () => {
    await as('mateo')
    await page.locator('.vbtn', { hasText: 'Send an invoice' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('What for').fill(what)
    await dlg.getByLabel('Amount').fill(amt)
    await dlg.locator('button', { hasText: /^Send invoice/ }).click()
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: 'Done' }).click().catch(() => {})
  })
}

// ---------- Ava (department head) ----------
await step('Ava: approve + add the held AWS payment (head key)', async () => {
  await as('ava', 'Approvals')
  const req = page.locator('.request', { hasText: 'AWS' }).first()
  await req.getByRole('button', { name: 'Approve + add' }).click()
  await toast(/Approved and added/)
})
await step('Ava: cannot approve the over-$1,000 request (Finance only)', async () => {
  const n = await page.locator('.request', { hasText: '$1,200' }).count()
  if (n !== 0) throw new Error('Finance-limit request is shown to the head')
})
await step('Ava: pay Mateo $120 invoice with the head key', async () => {
  const row = page.locator('.rows li', { hasText: '$120' }).first()
  await row.getByRole('button', { name: /Approve & pay/ }).click()
  await toast(/paid/i)
})
await step('Ava: edit card rules → re-issue cards', async () => {
  await as('ava', 'Team')
  await page.getByRole('button', { name: 'Edit rules' }).first().click()
  await page.getByRole('dialog').getByLabel(/Monthly limit/).fill('650')
  await page.getByRole('button', { name: /Save and re-issue/ }).click()
  await toast(/re-issued/, 90000)
})
await step('Ava: ask Finance for more budget', async () => {
  await page.getByRole('button', { name: 'Ask for more' }).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await toast(/Sent to Finance/)
})
await step('Ava: invite an employee to Design', async () => {
  await page.locator('button', { hasText: /^Invite$/ }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(`Audit Person ${Date.now() % 10000}`)
  await page.getByRole('button', { name: 'Create invite' }).click()
  await toast(/Invite link ready/)
  await page.getByRole('button', { name: 'Done' }).click()
})

// ---------- Jordan (Finance) ----------
await step('Jordan: fund the Design top-up request', async () => {
  await as('jordan')
  await page.locator('.rows li', { hasText: 'wants' }).first().getByRole('button', { name: 'Fund' }).click()
  await toast(/funded/)
})
await step('Jordan: approve the over-limit $1,200 request', async () => {
  await as('jordan')
  await page.locator('.request', { hasText: '$1,200' }).first().getByRole('button', { name: 'Approve', exact: true }).click()
  await toast(/Approved/)
})
await step('Jordan: decline Mateo $80 invoice with a reason', async () => {
  await as('jordan')
  await page.locator('.rows li', { hasText: '$80' }).first().getByRole('button', { name: 'Decline' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Decline' }).last().click()
  await toast(/declined/i)
})
await step('Jordan: run payday (one payment)', async () => {
  await as('jordan')
  await page.getByRole('button', { name: 'Review payday' }).first().click()
  await page.getByRole('button', { name: 'Run payday' }).click()
  await page.getByRole('button', { name: /Confirm/ }).click()
  await page.getByText('Payday complete.').waitFor({ timeout: 90000 })
  await page.getByRole('button', { name: 'Done' }).last().click()
})
await step('Jordan: add $50 to Engineering, then pull it back', async () => {
  await as('jordan', 'Departments')
  const eng = page.locator('.dept-card', { hasText: 'Engineering' })
  await eng.getByRole('button', { name: 'Move money' }).click()
  await eng.getByLabel(/Amount for Engineering/).fill('50')
  await eng.getByRole('button', { name: 'Add money' }).click()
  await toast(/sent to Engineering/)
  await eng.getByRole('button', { name: 'Move money' }).click()
  await eng.getByLabel(/Amount for Engineering/).fill('50')
  await eng.getByRole('button', { name: 'Pull back' }).click()
  await toast(/back from Engineering/)
})
await step('Jordan: appoint Leo as Marketing head (admin key)', async () => {
  const mkt = page.locator('.dept-card', { hasText: 'Marketing' })
  await mkt.getByRole('button', { name: /Appoint|Change/ }).click()
  await mkt.getByRole('combobox').selectOption({ label: 'Leo Martin' })
  await mkt.getByRole('button', { name: /Make head|Hand over key/ }).click()
  await toast(/now holds the Marketing head key/, 90000)
})
await step('Jordan: save the Finance limit', async () => {
  const rules = page.locator('.panel', { hasText: 'Company rules' })
  await rules.getByRole('button', { name: 'Save' }).click()
  await toast(/Finance limit saved/)
})
await step('Jordan: add a vendor', async () => {
  const rules = page.locator('.panel', { hasText: 'Company rules' })
  await rules.getByLabel('New vendor').fill(`AuditVendor${Date.now() % 10000}`)
  await rules.getByRole('button', { name: 'Add' }).click()
  await toast(/added/)
})
await step('Jordan: CSV export downloads', async () => {
  const r = await page.evaluate(async () => { const x = await fetch('/api/activity.csv'); return [x.status, (await x.text()).slice(0, 12)] })
  if (r[0] !== 200 || !/date/.test(r[1])) throw new Error(JSON.stringify(r))
})
// ---------- New features ----------
await step('Sam: send money to @ava by username', async () => {
  await as('sam')
  await page.locator('.vbtn', { hasText: 'Send' }).click()
  await page.getByText('Ava Chen').first().waitFor({ timeout: 8000 })
  await page.getByLabel('Amount').fill('3')
  await page.getByRole('button', { name: /^Send \$3 to Ava/ }).click()
  await page.locator('.stamp', { hasText: 'SENT' }).waitFor({ timeout: 45000 })
  await page.getByRole('button', { name: 'Done' }).click()
})
await step('Sam: send to a new payee and save them', async () => {
  await page.locator('.vbtn', { hasText: 'Send' }).click()
  await page.getByRole('tab', { name: 'New' }).click()
  await page.getByLabel('Name').fill('Audit Studio')
  await page.getByLabel('Tempo account ID').fill('0x' + 'cd'.repeat(20))
  await page.getByLabel('Amount').fill('2')
  await page.getByRole('button', { name: /^Send \$2 to Audit Studio/ }).click()
  await page.locator('.stamp', { hasText: 'SENT' }).waitFor({ timeout: 45000 })
  await page.getByRole('button', { name: 'Done' }).click()
  await page.locator('.vbtn', { hasText: 'Send' }).click()
  await page.getByRole('tab', { name: 'Saved' }).click()
  await page.getByRole('radio', { name: 'Audit Studio' }).waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: 'Back' }).click()
})
await step('Sam: get a Visa card and tap at Figma → approved, settled on Tempo', async () => {
  await as('sam', 'Spend')
  const get = page.getByRole('button', { name: 'Get your Visa card' })
  if (await get.count()) { await get.click(); await toast(/Visa card is ready/, 60000) }
  await page.getByRole('button', { name: 'Tap at a shop' }).click()
  await page.getByRole('radio', { name: /Figma/ }).click()
  await page.getByRole('dialog').getByLabel('Amount').fill('6')
  await page.getByRole('button', { name: /^Tap \$6 at Figma/ }).click()
  await page.getByText('Approved at Figma').first().waitFor({ timeout: 45000 })
  await page.getByRole('link', { name: /public record/i }).waitFor()
  await page.getByRole('button', { name: 'Done' }).click()
})
await step('Sam: tap at the Apple Store → declined, sent to Ava', async () => {
  await page.getByRole('button', { name: 'Tap at a shop' }).click()
  await page.getByRole('radio', { name: /Apple Store/ }).click()
  await page.getByRole('dialog').getByLabel('Amount').fill('6')
  await page.getByRole('button', { name: /^Tap \$6 at Apple Store/ }).click()
  await page.getByText('Declined at Apple Store').first().waitFor({ timeout: 45000 })
  await page.getByRole('button', { name: 'Done' }).click()
})
await step('Ava: add an agent with its own card', async () => {
  await as('ava', 'Team')
  await page.getByRole('button', { name: 'Add agent' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Audit Bot')
  await page.getByRole('button', { name: 'Give it a card' }).click()
  await page.getByLabel('Agent key').waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Done' }).click()
})
await step('Ava: run the agent’s test purchase on its card', async () => {
  const row = page.locator('.rows li', { hasText: 'Audit Bot' })
  await row.getByRole('button', { name: 'Test purchase' }).click()
  await toast(/Audit Bot paid/, 60000)
})
await step('Ava: approve once the declined Apple Store card payment', async () => {
  await as('ava', 'Approvals')
  await page.locator('.request', { hasText: 'Apple Store' }).first().getByRole('button', { name: 'Approve', exact: true }).click()
  await toast(/Approved/)
})
await step('Ava: close the quarter (kudos from savings)', async () => {
  await as('ava', 'Team')
  await page.getByRole('button', { name: 'Close quarter' }).click()
  await toast(/Quarter closed/, 90000)
})
await step('Sam: send kudos to a teammate', async () => {
  await as('sam', 'Spend')
  await page.getByRole('button', { name: 'Send kudos' }).click()
  await toast(/Kudos sent/, 60000)
})
await step('Jordan: put idle Engineering budget to work, then bring some back', async () => {
  await as('jordan', 'Departments')
  const eng = page.locator('.dept-card', { hasText: 'Engineering' })
  await eng.getByRole('button', { name: 'Manage' }).click()
  await eng.getByLabel(/Earn amount for Engineering/).fill('400')
  await eng.getByRole('button', { name: 'Put to work' }).click()
  await toast(/is earning/)
  await eng.getByRole('button', { name: 'Manage' }).click()
  await eng.getByLabel(/Earn amount for Engineering/).fill('100')
  await eng.getByRole('button', { name: 'Bring back' }).click()
  await toast(/back in Engineering/)
})
await step('Ava: an invoice over the Finance limit shows "Finance pays this"', async () => {
  await as('mateo')
  await page.locator('.vbtn', { hasText: 'Send an invoice' }).click()
  const dlg = page.getByRole('dialog'); await dlg.getByLabel('What for').fill('Big project'); await dlg.getByLabel('Amount').fill('1500')
  await dlg.locator('button', { hasText: /^Send invoice/ }).click(); await page.waitForTimeout(2500); await page.getByRole('button', { name: 'Done' }).click().catch(() => {})
  await as('ava', 'Approvals')
  await page.locator('.rows li', { hasText: '$1,500' }).first().getByText('Finance pays this').waitFor({ timeout: 8000 })
})
await step('Everyone: How it works sheet opens', async () => {
  await page.getByRole('button', { name: 'How Teampot works' }).click()
  await page.getByText('Tempo enforces').waitFor()
  await page.getByRole('button', { name: 'Done' }).click()
})

await browser.close()
const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? `  (${(r.ms / 1000).toFixed(1)}s)` : `\n      ${r.err}${r.toasts ? `\n      toasts: ${r.toasts}` : ''}`}`)
console.log(`\n${results.length - failed.length}/${results.length} passed · console errors: ${consoleErrors.length}`)
for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log('  console:', e.slice(0, 200))
process.exit(failed.length ? 1 : 0)
