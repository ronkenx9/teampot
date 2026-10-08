import 'dotenv/config'

const B = (process.env.BASE || 'http://localhost:8790') + '/api'
const headers = { 'content-type': 'application/json', ...(process.env.RESET_TOKEN ? { 'x-reset-token': process.env.RESET_TOKEN } : {}) }
const post = async (p, b = {}) => {
  const r = await fetch(B + p, { method: 'POST', headers, body: JSON.stringify(b) })
  const body = await r.json()
  if (!r.ok) throw new Error(`${p} ${r.status}: ${body.error || JSON.stringify(body)}`)
  return body
}
const get = async (p) => {
  const r = await fetch(B + p)
  const body = await r.json()
  if (!r.ok) throw new Error(`${p} ${r.status}: ${body.error || JSON.stringify(body)}`)
  return body
}
const assert = (ok, msg) => { if (!ok) throw new Error(msg) }
const short = (x) => JSON.stringify(x).slice(0, 220)

await post('/reset').catch(() => null)
let st = await get('/state')
if (!st.seeded) await post('/setup')
st = await get('/state')
const v = (n) => st.vendors.find((x) => x.name === n).id
const samPerk = st.perks.find((p) => p.personId === 'sam' && p.name === 'Lunch')
const out = {}

out.spendOk = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 45, note: 'Figma seat', requestId: 'e2e-spend-ok' })
assert(out.spendOk.ok && out.spendOk.tx, 'approved pot spend failed')

out.perk = await post('/spend', { personId: 'sam', vendorId: v('Uber Eats'), amount: 12, note: 'Lunch', source: 'perk', perkId: samPerk.id, requestId: 'e2e-perk' })
assert(out.perk.ok && out.perk.tx, 'perk spend failed')

out.newVendor = await post('/spend', { personId: 'sam', vendorId: v('PixelVault Stock'), amount: 120, note: 'Stock photos', requestId: 'e2e-held-new' })
assert(out.newVendor.held?.status === 'held', 'new vendor was not held')
out.approveAdd = await post(`/held/${out.newVendor.held.id}/approve-add`, { requestId: 'e2e-approve-add' })
assert(out.approveAdd.status === 'approved', 'approve-and-add failed')
st = await get('/state')
assert(st.pots.find((p) => p.id === 'design').vendorIds.includes(v('PixelVault Stock')), 'vendor was not added to pot')
out.nextTime = await post('/spend', { personId: 'sam', vendorId: v('PixelVault Stock'), amount: 15, note: 'Tiny asset', requestId: 'e2e-after-add' })
assert(out.nextTime.ok, 'added vendor did not work next time')

out.overLimit = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 700, note: 'Team plan', requestId: 'e2e-held-limit' })
assert(out.overLimit.held?.reason === 'over-limit', 'over-limit payment was not held')
out.returned = await post(`/held/${out.overLimit.held.id}/return`, { requestId: 'e2e-return' })
assert(out.returned.status === 'returned', 'return failed')

out.payday = await post('/payday', { requestId: 'e2e-payday' })
out.paydayAgain = await post('/payday', { requestId: 'e2e-payday' })
assert(out.payday.tx === out.paydayAgain.tx, 'payday idempotency failed')

const invDecline = await post('/invoices', { contractorId: 'mateo', amount: 220, description: 'Draft sketches', requestId: 'e2e-invoice-decline' })
out.invoiceDecline = await post(`/invoices/${invDecline.id}/decline`, { reason: 'Needs final files', requestId: 'e2e-decline' })
assert(out.invoiceDecline.status === 'declined', 'invoice decline failed')
const inv = await post('/invoices', { contractorId: 'mateo', amount: 1800, description: 'Q4 campaign illustrations', requestId: 'e2e-invoice-pay' })
out.invoicePay = await post(`/invoices/${inv.id}/pay`, { requestId: 'e2e-pay-invoice' })
assert(out.invoicePay.status === 'paid' && out.invoicePay.paidMs >= 0, 'invoice pay failed')

out.close = await post('/pots/design/close', { sharePct: 20, requestId: 'e2e-close' })
assert(out.close.tx && out.close.pool > 0, 'quarter close failed')
out.kudos = await post('/kudos', { fromPersonId: 'sam', toPersonId: 'ava', amount: 1, note: 'Tiny miracle', requestId: 'e2e-kudos' })
assert(out.kudos.tx, 'kudos failed')

const csv = await fetch(B + '/activity.csv').then((r) => r.text())
assert(csv.includes('date,') || csv.includes('"date"'), 'CSV export failed')
const after = await get('/state')
assert(after.paydayRuns.length > 0, 'payday history missing')
assert(after.quarterCloses.length > 0, 'quarter close history missing')
assert(after.invoices.some((i) => i.status === 'declined'), 'declined invoice missing')

for (const [k, val] of Object.entries(out)) console.log(k.padEnd(14), short(val))
console.log('e2e ok')
