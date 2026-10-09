import 'dotenv/config'

const B = (process.env.BASE || 'http://localhost:8790') + '/api'
let cookie = ''
const headers = () => ({ 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(process.env.RESET_TOKEN ? { 'x-reset-token': process.env.RESET_TOKEN } : {}) })
const post = async (p, b = {}) => {
  const r = await fetch(B + p, { method: 'POST', headers: headers(), body: JSON.stringify(b) })
  const set = r.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0]
  const body = await r.json()
  if (!r.ok) throw new Error(`${p} ${r.status}: ${body.error || JSON.stringify(body)}`)
  return body
}
const get = async (p) => {
  const r = await fetch(B + p, { headers: cookie ? { cookie } : {} })
  const body = await r.json()
  if (!r.ok) throw new Error(`${p} ${r.status}: ${body.error || JSON.stringify(body)}`)
  return body
}
const assert = (ok, msg) => { if (!ok) throw new Error(msg) }
const short = (x) => JSON.stringify(x).slice(0, 220)

await post('/reset').catch(() => null)
let st = await post('/auth/demo', { personId: 'jordan' }).then(() => get('/state'))
if (!st.seeded) await post('/setup')
st = await get('/state')
const v = (n) => st.vendors.find((x) => x.name === n).id
const samPerk = st.perks.find((p) => p.personId === 'sam' && p.name === 'Lunch')
const designStart = st.pots.find((p) => p.id === 'design').balance
assert(designStart > 0, 'Design department was not funded')
const out = {}

await post('/auth/demo', { personId: 'sam' })
out.spendOk = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 45, note: 'Figma seat', requestId: 'e2e-spend-ok' })
assert(out.spendOk.ok && out.spendOk.tx, 'approved pot spend failed')
st = await get('/state')
assert(st.pots.find((p) => p.id === 'design').balance < designStart, 'department balance did not move after Sam spend')

out.perk = await post('/spend', { personId: 'sam', vendorId: v('Uber Eats'), amount: 12, note: 'Lunch', source: 'perk', perkId: samPerk.id, requestId: 'e2e-perk' })
assert(out.perk.ok && out.perk.tx, 'perk spend failed')

out.newVendor = await post('/spend', { personId: 'sam', vendorId: v('PixelVault Stock'), amount: 120, note: 'Stock photos', requestId: 'e2e-held-new' })
assert(out.newVendor.held?.status === 'held', 'new vendor was not held')
await post('/auth/demo', { personId: 'ava' })
out.approveAdd = await post(`/held/${out.newVendor.held.id}/approve-add`, { requestId: 'e2e-approve-add', approverId: 'ava' })
assert(out.approveAdd.status === 'approved', 'approve-and-add failed')
st = await get('/state')
assert(st.pots.find((p) => p.id === 'design').vendorIds.includes(v('PixelVault Stock')), 'vendor was not added to pot')
assert(st.pots.find((p) => p.id === 'design').balance < designStart - 45, 'approval did not come from the department account')
await post('/auth/demo', { personId: 'sam' })
out.nextTime = await post('/spend', { personId: 'sam', vendorId: v('PixelVault Stock'), amount: 15, note: 'Tiny asset', requestId: 'e2e-after-add' })
assert(out.nextTime.ok, 'added vendor did not work next time')

out.overLimit = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 700, note: 'Team plan', requestId: 'e2e-held-limit' })
assert(out.overLimit.held?.reason === 'over-limit', 'over-limit payment was not held')
await post('/auth/demo', { personId: 'ava' })
out.returned = await post(`/held/${out.overLimit.held.id}/return`, { requestId: 'e2e-return', approverId: 'ava' })
assert(out.returned.status === 'returned', 'return failed')

await post('/auth/demo', { personId: 'sam' })
out.financeRule = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 1200, note: 'Annual design suite', requestId: 'e2e-finance-rule' })
assert(out.financeRule.held?.reason === 'finance-rule', 'over-threshold payment did not become a Finance decision')
await post('/auth/demo', { personId: 'ava' })
out.leadFinanceRule = await post(`/held/${out.financeRule.held.id}/approve`, { requestId: 'e2e-lead-finance-rule', approverId: 'ava' }).then(() => 'ALLOWED', (e) => e.message)
assert(/403:/.test(out.leadFinanceRule), 'lead approved a Finance-only decision')
await post('/auth/demo', { personId: 'jordan' })
out.financeRuleReturn = await post(`/held/${out.financeRule.held.id}/return`, { requestId: 'e2e-finance-rule-return', approverId: 'jordan' })
assert(out.financeRuleReturn.status === 'returned', 'Finance rule decision was not returned by Finance')

// A lead can't approve their own request; Finance can.
await post('/auth/demo', { personId: 'ava' })
out.leadOwn = await post('/spend', { personId: 'ava', vendorId: v('Delta'), amount: 40, note: 'Train', requestId: 'e2e-lead-own' })
assert(out.leadOwn.held?.status === 'held', 'lead off-list spend was not held')
out.selfApprove = await post(`/held/${out.leadOwn.held.id}/approve`, { requestId: 'e2e-self-approve', approverId: 'ava' }).then(() => 'ALLOWED', (e) => e.message)
assert(/403: You can't approve your own request/.test(out.selfApprove), 'lead was allowed to approve their own request')
await post('/auth/demo', { personId: 'jordan' })
out.financeReturn = await post(`/held/${out.leadOwn.held.id}/return`, { requestId: 'e2e-finance-return', approverId: 'jordan' })
assert(out.financeReturn.status === 'returned', 'finance could not decide the lead request')

await post('/auth/demo', { personId: 'ava' })
const beforeReturn = (await get('/state')).pots.find((p) => p.id === 'design').balance
out.returnBudget = await post('/pots/design/return', { amount: 10, requestId: 'e2e-dept-return' })
assert(out.returnBudget.tx, 'department did not return unspent money')
st = await get('/state')
assert(st.pots.find((p) => p.id === 'design').balance < beforeReturn, 'department balance did not decrease after return')

await post('/auth/demo', { personId: 'jordan' })
out.payday = await post('/payday', { requestId: 'e2e-payday' })
out.paydayAgain = await post('/payday', { requestId: 'e2e-payday' })
assert(out.payday.tx === out.paydayAgain.tx, 'payday idempotency failed')

await post('/auth/demo', { personId: 'mateo' })
const invDecline = await post('/invoices', { contractorId: 'mateo', amount: 220, description: 'Draft sketches', requestId: 'e2e-invoice-decline' })
await post('/auth/demo', { personId: 'jordan' })
out.invoiceDecline = await post(`/invoices/${invDecline.id}/decline`, { reason: 'Needs final files', requestId: 'e2e-decline' })
assert(out.invoiceDecline.status === 'declined', 'invoice decline failed')
await post('/auth/demo', { personId: 'mateo' })
const inv = await post('/invoices', { contractorId: 'mateo', amount: 1800, description: 'Q4 campaign illustrations', requestId: 'e2e-invoice-pay' })
await post('/auth/demo', { personId: 'jordan' })
out.invoicePay = await post(`/invoices/${inv.id}/pay`, { requestId: 'e2e-pay-invoice' })
assert(out.invoicePay.status === 'paid' && out.invoicePay.paidMs >= 0, 'invoice pay failed')

await post('/auth/demo', { personId: 'ava' })
out.close = await post('/pots/design/close', { sharePct: 20, requestId: 'e2e-close' })
assert(out.close.tx && out.close.pool > 0, 'quarter close failed')
await post('/auth/demo', { personId: 'sam' })
out.kudos = await post('/kudos', { fromPersonId: 'sam', toPersonId: 'ava', amount: 1, note: 'Tiny miracle', requestId: 'e2e-kudos' })
assert(out.kudos.tx, 'kudos failed')

await post('/auth/demo', { personId: 'jordan' })
const csv = await fetch(B + '/activity.csv', { headers: { cookie } }).then((r) => r.text())
assert(csv.includes('date,') || csv.includes('"date"'), 'CSV export failed')
const after = await get('/state')
assert(after.paydayRuns.length > 0, 'payday history missing')
assert(after.quarterCloses.length > 0, 'quarter close history missing')
assert(after.invoices.some((i) => i.status === 'declined'), 'declined invoice missing')

for (const [k, val] of Object.entries(out)) console.log(k.padEnd(14), short(val))
console.log('e2e ok')
