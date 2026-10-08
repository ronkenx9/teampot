// End-to-end API check against the live testnet-backed server.
const B = (process.env.BASE || 'http://localhost:8787') + '/api'
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json())
const st = await fetch(B + '/state').then((r) => r.json())
const v = (n) => st.vendors.find((x) => x.name === n).id
const out = {}
out.spendOk = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 45, note: 'Figma seat' })
out.newVendor = await post('/spend', { personId: 'sam', vendorId: v('PixelVault Stock'), amount: 120, note: 'Stock photos' })
out.overLimit = await post('/spend', { personId: 'sam', vendorId: v('Figma'), amount: 700, note: 'Team plan' })
out.approve = await post(`/held/${out.newVendor.held.id}/approve`)
out.returned = await post(`/held/${out.overLimit.held.id}/return`)
out.payday = await post('/payday')
const inv = await post('/invoices', { contractorId: 'mateo', amount: 1800, description: 'Q4 campaign illustrations' })
out.invoicePay = await post(`/invoices/${inv.id}/pay`)
const after = await fetch(B + '/state').then((r) => r.json())
out.sam = after.people.find((p) => p.id === 'sam')
out.mateo = after.people.find((p) => p.id === 'mateo')
for (const [k, val] of Object.entries(out)) console.log(k.padEnd(11), JSON.stringify(val).slice(0, 230))
