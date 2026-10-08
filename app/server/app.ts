// Teampot API: payday, team pots (chain-enforced caps + vendor locks), held approvals, contractor invoices.
import { Hono } from 'hono'
import * as T from './tempo.js'
import * as Store from './store.js'

type Person = { id: string; name: string; role: 'admin' | 'lead' | 'employee' | 'contractor'; team?: string; title: string; salary?: number; address: string; demoKey?: boolean; keyTx?: string; passkey?: { id: string; publicKey: `0x${string}`; tx: string }; country?: string }
type Vendor = { id: string; name: string; category: string; address: string }
type Pot = { id: string; team: string; perPersonCap: number; periodLabel: string; periodSec: number; vendorIds: string[]; color: string }
type Activity = { id: string; at: number; kind: 'payday' | 'spend' | 'held' | 'approved' | 'returned' | 'invoice' | 'paid' | 'setup'; title: string; detail: string; amount?: number; who?: string; tx?: string; potId?: string }
type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit'; status: 'held' | 'approved' | 'returned'; tx?: string }
type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid'; tx?: string; paidMs?: number }
type State = { epoch: string; company: { name: string; address: string }; people: Person[]; vendors: Vendor[]; pots: Pot[]; activity: Activity[]; held: Held[]; invoices: Invoice[]; seeded: boolean }

const uid = () => Math.random().toString(36).slice(2, 10)
const MONTH = 30 * 86400

function seedState(): State {
  const v = (name: string, category: string): Vendor => ({ id: uid(), name, category, address: T.newAddress() })
  const vendors = [v('Figma', 'Software'), v('Adobe Fonts', 'Software'), v('AWS', 'Cloud'), v('Notion', 'Software'), v('Delta', 'Travel'), v('Uber Eats', 'Meals'), v('Linear', 'Software'), v('PixelVault Stock', 'Assets')]
  const id = (n: string) => vendors.find((x) => x.name === n)!.id
  const pots: Pot[] = [
    { id: 'design', team: 'Design', perPersonCap: 600, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Figma'), id('Adobe Fonts'), id('Notion'), id('Uber Eats')], color: '#E8552D' },
    { id: 'eng', team: 'Engineering', perPersonCap: 1500, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('AWS'), id('Linear'), id('Notion'), id('Uber Eats')], color: '#2F6FEB' },
    { id: 'mkt', team: 'Marketing', perPersonCap: 900, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Delta'), id('Notion'), id('Uber Eats')], color: '#1F9D6B' },
  ]
  const p = (name: string, role: Person['role'], title: string, team?: string, salary?: number, country?: string): Person =>
    ({ id: name.toLowerCase().split(' ')[0], name, role, title, team, salary, country, address: T.newAddress(), demoKey: role === 'lead' || role === 'employee' })
  return {
    epoch: uid(),
    company: { name: 'Northwind Studio', address: T.companyAccount.address },
    people: [
      p('Jordan Lee', 'admin', 'Head of Finance'),
      p('Ava Chen', 'lead', 'Design Lead', 'design', 4200),
      p('Sam Okafor', 'employee', 'Product Designer', 'design', 3600),
      p('Priya Nair', 'employee', 'Software Engineer', 'eng', 4800),
      p('Leo Martin', 'employee', 'Growth Marketer', 'mkt', 3900),
      p('Mateo Ruiz', 'contractor', 'Illustrator', undefined, undefined, 'Mexico'),
      p('Yuki Tanaka', 'contractor', 'Copywriter', undefined, undefined, 'Japan'),
    ],
    vendors, pots, activity: [], held: [], invoices: [], seeded: false,
  }
}

// Loaded fresh for every request (serverless-safe); POSTs persist after the handler runs.
let S: State
const log = (a: Omit<Activity, 'id' | 'at'>) => { S.activity.unshift({ id: uid(), at: Date.now(), ...a }) }
const keyPk = (x: Person) => T.derivedKeyPk(S.epoch, x.id)
const person = (id: string) => S.people.find((x) => x.id === id)!
const vendor = (id: string) => S.vendors.find((x) => x.id === id)!
const pot = (id: string) => S.pots.find((x) => x.id === id)!
/** Passkey wins once enrolled; before that the demo server key is used. */
const keyRef = (x: Person): T.KeyRef | null => (x.passkey ? { passkey: x.passkey.publicKey } : x.demoKey ? { pk: keyPk(x) } : null)

/** Public view: never ship private keys or raw addresses to the UI (receipts carry tx links). */
async function view() {
  const people = await Promise.all(S.people.map(async (x) => {
    const pt = x.team ? pot(x.team) : undefined
    const ref = keyRef(x)
    const limit = ref && S.seeded ? await T.remaining(ref).catch(() => null) : null
    return { id: x.id, name: x.name, role: x.role, hasPasskey: !!x.passkey, passkeyId: x.passkey?.id, title: x.title, team: x.team, salary: x.salary, country: x.country,
      balance: await T.balanceOf(x.address).catch(() => 0), pot: pt ? { cap: pt.perPersonCap, left: limit?.remaining ?? null, resetsAt: limit?.periodEnd ?? null } : null }
  }))
  return {
    company: { name: S.company.name, balance: await T.balanceOf(S.company.address) },
    people, pots: S.pots.map((p) => ({ ...p, approved: S.held.filter((h) => h.potId === p.id && h.status === 'approved').reduce((a, h) => a + h.amount, 0), vendors: p.vendorIds.map((v) => vendor(v).name), members: S.people.filter((x) => x.team === p.id).map((x) => x.id) })),
    vendors: S.vendors.map(({ id, name, category }) => ({ id, name, category })),
    activity: S.activity.slice(0, 60).map((a) => ({ ...a, receipt: a.tx ? T.EXPLORER + a.tx : undefined })),
    held: S.held, invoices: S.invoices, seeded: S.seeded,
  }
}

export const app = new Hono()
app.onError((e, c) => c.json({ error: e.message }, 500))
// Requests run one at a time: each loads state, mutates it, and (for POSTs) saves before the next starts.
let queue: Promise<unknown> = Promise.resolve()
app.use('/api/*', (c, next) => {
  const run = queue.then(async () => {
    S = (await Store.load<State>()) ?? seedState()
    await next()
    if (c.req.method === 'POST') await Store.save(S)
  })
  queue = run.catch(() => {})
  return run
})
app.get('/api/state', async (c) => c.json(await view()))

// One-time setup: issue every team member a spending key (cap per month + vendor allowlist).
app.post('/api/setup', async (c) => {
  if (S.seeded) return c.json(await view())
  for (const x of S.people.filter((p) => p.demoKey)) {
    const pt = pot(x.team!)
    x.keyTx = await T.issueKey({ pk: keyPk(x) }, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
    log({ kind: 'setup', title: `${x.name} joined the ${pt.team} pot`, detail: `$${pt.perPersonCap}/${pt.periodLabel} · ${pt.vendorIds.length} approved vendors`, tx: x.keyTx, potId: pt.id, who: x.id })
  }
  S.seeded = true
  return c.json(await view())
})

app.post('/api/payday', async (c) => {
  const staff = S.people.filter((x) => x.salary)
  const date = new Date().toISOString().slice(0, 10)
  const r = await T.payday(staff.map((x) => ({ to: x.address, amount: x.salary!, note: `payday ${date}` })))
  const total = staff.reduce((s, x) => s + x.salary!, 0)
  log({ kind: 'payday', title: `Payday · ${staff.length} people paid`, detail: `Landed in ${(r.ms / 1000).toFixed(1)}s, one transaction`, amount: total, tx: r.tx })
  return c.json({ ...r, total, count: staff.length })
})

// Spend from a pot. The chain enforces the person's monthly cap and the vendor allowlist.
app.post('/api/spend', async (c) => {
  const { personId, vendorId, amount, note } = await c.req.json()
  const x = person(personId), v = vendor(vendorId), pt = pot(x.team!)
  try {
    const tx = await T.spendWithKey(keyPk(x), v.address, Number(amount), `${pt.id}:${note || v.category}`)
    log({ kind: 'spend', title: `${x.name.split(' ')[0]} paid ${v.name}`, detail: `${pt.team} pot · ${note || v.category}`, amount: Number(amount), tx, who: x.id, potId: pt.id })
    return c.json({ ok: true, tx, receipt: T.EXPLORER + tx })
  } catch (e: any) {
    return c.json({ ok: false, held: hold(x, v, pt, Number(amount), note), chainError: String(e.shortMessage || e.message).split('\n')[0] })
  }
})

function hold(x: Person, v: Vendor, pt: Pot, amount: number, note: string) {
  const reason = pt.vendorIds.includes(v.id) ? 'over-limit' : 'new-vendor'
  const h: Held = { id: uid(), at: Date.now(), personId: x.id, potId: pt.id, vendorId: v.id, amount, note: note || v.category, reason, status: 'held' }
  S.held.unshift(h)
  log({ kind: 'held', title: `Held for approval: ${v.name}`, detail: reason === 'new-vendor' ? `${v.name} isn't on the ${pt.team} list yet` : `Over ${x.name.split(' ')[0]}'s monthly limit`, amount, who: x.id, potId: pt.id })
  return h
}

// ---- Device passkeys: Face ID / Touch ID becomes the person's spending key. ----
// Enroll: the browser created a passkey; the company authorizes its public key with the pot's limit + vendor list.
app.post('/api/passkey/enroll', async (c) => {
  const { personId, id, publicKey } = await c.req.json()
  const x = person(personId), pt = pot(x.team!)
  const tx = await T.issueKey({ passkey: publicKey }, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  if (x.demoKey && !x.passkey) await T.revokeKey({ pk: keyPk(x) }).catch(() => {}) // one key per person: no doubled allowance
  x.passkey = { id, publicKey, tx }
  log({ kind: 'setup', title: `${x.name.split(' ')[0]} turned on Face ID`, detail: `Pays from the ${pt.team} pot with this device`, tx, who: x.id, potId: pt.id })
  return c.json({ ok: true })
})

// What the device needs to sign a payment itself (public addresses only).
app.get('/api/passkey/pay-info/:personId', (c) => {
  const x = person(c.req.param('personId'))
  return c.json({ company: S.company.address, token: T.TOKEN, credentialId: x.passkey?.id, publicKey: x.passkey?.publicKey,
    vendors: Object.fromEntries(S.vendors.map((v) => [v.id, v.address])), potId: x.team })
})

// The device reports the outcome; successful payments are checked on-chain before they're recorded.
app.post('/api/passkey/record', async (c) => {
  const { personId, vendorId, amount, note, tx, rejected } = await c.req.json()
  const x = person(personId), v = vendor(vendorId), pt = pot(x.team!)
  if (rejected) return c.json({ ok: false, held: hold(x, v, pt, Number(amount), note) })
  if (S.activity.some((a) => a.tx === tx)) return c.json({ error: 'Payment already recorded' }, 409)
  if (!(await T.verifySpend(tx, v.address, Number(amount)))) return c.json({ error: 'Payment could not be confirmed' }, 400)
  log({ kind: 'spend', title: `${x.name.split(' ')[0]} paid ${v.name}`, detail: `${pt.team} pot · ${note || v.category} · Face ID`, amount: Number(amount), tx, who: x.id, potId: pt.id })
  return c.json({ ok: true, tx, receipt: T.EXPLORER + tx })
})

app.post('/api/held/:id/:action', async (c) => {
  const h = S.held.find((x) => x.id === c.req.param('id'))!
  if (h.status !== 'held') return c.json(h)
  if (c.req.param('action') === 'approve') {
    const v = vendor(h.vendorId)
    h.tx = await T.companyPay(v.address, h.amount, `${h.potId}:approved`)
    h.status = 'approved'
    log({ kind: 'approved', title: `Approved: ${v.name}`, detail: `Paid by ${S.company.name} · counts toward the ${pot(h.potId).team} pot`, amount: h.amount, tx: h.tx, who: h.personId, potId: h.potId })
  } else {
    h.status = 'returned'
    log({ kind: 'returned', title: `Returned: ${vendor(h.vendorId).name}`, detail: 'Nothing was paid', amount: h.amount, who: h.personId, potId: h.potId })
  }
  return c.json(h)
})

app.post('/api/invoices', async (c) => {
  const { contractorId, amount, description } = await c.req.json()
  const inv: Invoice = { id: uid(), number: `INV-${String(1040 + S.invoices.length + 1)}`, at: Date.now(), contractorId, amount: Number(amount), description, status: 'submitted' }
  S.invoices.unshift(inv)
  log({ kind: 'invoice', title: `${person(contractorId).name} sent ${inv.number}`, detail: description, amount: inv.amount, who: contractorId })
  return c.json(inv)
})

app.post('/api/invoices/:id/pay', async (c) => {
  const inv = S.invoices.find((x) => x.id === c.req.param('id'))!
  if (inv.status === 'paid') return c.json(inv)
  const t0 = Date.now()
  inv.tx = await T.companyPay(person(inv.contractorId).address, inv.amount, inv.number)
  inv.paidMs = Date.now() - t0; inv.status = 'paid'
  log({ kind: 'paid', title: `${person(inv.contractorId).name} paid · ${inv.number}`, detail: `Landed in ${(inv.paidMs / 1000).toFixed(1)}s`, amount: inv.amount, tx: inv.tx, who: inv.contractorId })
  return c.json(inv)
})

// Demo reset. Requires RESET_TOKEN when one is configured (always set it on public deployments).
app.post('/api/reset', (c) => {
  const need = process.env.RESET_TOKEN
  if (need && c.req.header('x-reset-token') !== need) return c.json({ error: 'Not allowed' }, 403)
  S = seedState()
  return c.json({ ok: true })
})
