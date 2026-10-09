import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import * as T from './tempo.js'
import * as Store from './store.js'
import {
  DAY, MONTH, YEAR, applyKudosDebit, canAwardKudos, decodeMemoLabel, holdReason, idempotent, invoiceNumber,
  moneyMemo, nextMonthlyDate, normalizeState, potApprovedTotal, potSavings, roundMoney, slug, splitKudos, uid,
  type Activity, type Held, type Invoice, type Perk, type Person, type Pot, type State, type Vendor,
} from './domain.js'

const colors = ['#E8552D', '#C8D69B', '#F6E6A5', '#B8401C', '#3D7C8A', '#7A5CFF']
const number = z.coerce.number().finite().positive()
const optionalNumber = z.coerce.number().finite().nonnegative().optional()
const text = (max = 120) => z.string().trim().min(1).max(max)
const requestId = z.string().trim().min(6).max(120).optional()

function seedState(): State {
  const v = (name: string, category: string): Vendor => ({ id: slug(name), name, category, address: T.newAddress() })
  const vendors = [v('Figma', 'Software'), v('Adobe Fonts', 'Software'), v('AWS', 'Cloud'), v('Notion', 'Software'), v('Delta', 'Travel'), v('Uber Eats', 'Meals'), v('Linear', 'Software'), v('PixelVault Stock', 'Assets'), v('Udemy', 'Learning')]
  const id = (n: string) => vendors.find((x) => x.name === n)!.id
  const pots: Pot[] = [
    { id: 'design', team: 'Design', perPersonCap: 600, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Figma'), id('Adobe Fonts'), id('Notion'), id('Uber Eats')], color: '#E8552D' },
    { id: 'eng', team: 'Engineering', perPersonCap: 1500, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('AWS'), id('Linear'), id('Notion'), id('Uber Eats')], color: '#3D7C8A' },
    { id: 'mkt', team: 'Marketing', perPersonCap: 900, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Delta'), id('Notion'), id('Uber Eats')], color: '#7A5CFF' },
  ]
  const p = (name: string, role: Person['role'], title: string, team?: string, salary?: number, country?: string): Person =>
    ({ id: name.toLowerCase().split(' ')[0], name, role, title, team, salary, country, address: T.newAddress(), demoKey: role === 'lead' || role === 'employee' })
  const people = [
    p('Jordan Lee', 'admin', 'Head of Finance'),
    p('Ava Chen', 'lead', 'Design Lead', 'design', 4200),
    p('Sam Okafor', 'employee', 'Product Designer', 'design', 3600),
    p('Priya Nair', 'employee', 'Software Engineer', 'eng', 4800),
    p('Leo Martin', 'employee', 'Growth Marketer', 'mkt', 3900),
    p('Mateo Ruiz', 'contractor', 'Illustrator', undefined, undefined, 'Mexico'),
    p('Yuki Tanaka', 'contractor', 'Copywriter', undefined, undefined, 'Japan'),
  ]
  const perks: Perk[] = [
    { id: 'sam-lunch', personId: 'sam', name: 'Lunch', cap: 15, periodLabel: 'day', periodSec: DAY, vendorIds: [id('Uber Eats')], color: '#F6E6A5' },
    { id: 'sam-learning', personId: 'sam', name: 'Learning', cap: 1500, periodLabel: 'year', periodSec: YEAR, vendorIds: [id('Udemy')], color: '#C8D69B' },
    { id: 'ava-lunch', personId: 'ava', name: 'Lunch', cap: 15, periodLabel: 'day', periodSec: DAY, vendorIds: [id('Uber Eats')], color: '#F6E6A5' },
  ]
  return {
    epoch: uid(),
    company: { name: 'Northwind Studio', address: T.companyAccount.address },
    people, vendors, pots, perks,
    activity: [], held: [], invoices: [], paydayRuns: [], quarterCloses: [], kudosCredits: [], kudosAwards: [],
    nextPayday: nextMonthlyDate(), processed: {}, seeded: false,
  }
}

let S: State
const log = (a: Omit<Activity, 'id' | 'at'>) => { S.activity.unshift({ id: uid(), at: Date.now(), ...a }) }
const keyPk = (x: Person, version = x.keyVersion ?? 0) => T.derivedKeyPk(S.epoch, x.id, `pot:${x.team ?? 'none'}:${version}`)
const perkKeyPk = (perkId: string) => T.derivedKeyPk(S.epoch, perkId, 'perk')
const keyRef = (x: Person): T.KeyRef | null => (x.passkey && !x.passkey.needsRefresh ? { passkey: x.passkey.publicKey } : x.demoKey ? { pk: keyPk(x) } : null)
const requireOne = <T,>(item: T | undefined, label: string) => {
  if (!item) {
    const e: any = new Error(`${label} not found`)
    e.status = 404
    throw e
  }
  return item
}
const person = (id: string) => requireOne(S.people.find((x) => x.id === id), 'Person')
const vendor = (id: string) => requireOne(S.vendors.find((x) => x.id === id), 'Vendor')
const pot = (id: string) => requireOne(S.pots.find((x) => x.id === id), 'Pot')
const perk = (id: string) => requireOne(S.perks.find((x) => x.id === id), 'Perk')

type CacheEntry<T> = { at: number; value: T }
const cache = { balance: new Map<string, CacheEntry<number>>(), limit: new Map<string, CacheEntry<{ remaining: number; periodEnd: number | null }>>() }
const fresh = <T,>(e: CacheEntry<T> | undefined) => e && Date.now() - e.at < 5000 ? e.value : null
const invalidateCache = () => { cache.balance.clear(); cache.limit.clear() }
async function cachedBalance(address: string) {
  const hit = fresh(cache.balance.get(address)); if (hit !== null) return hit
  const value = await T.balanceOf(address).catch(() => 0)
  cache.balance.set(address, { at: Date.now(), value })
  return value
}
async function cachedRemaining(label: string, ref: T.KeyRef | null) {
  if (!ref || !S.seeded) return null
  const hit = fresh(cache.limit.get(label)); if (hit) return hit
  const value = await T.remaining(ref).catch(() => null)
  if (value) cache.limit.set(label, { at: Date.now(), value })
  return value
}

async function issuePotKey(x: Person) {
  if (!x.team || x.role === 'contractor' || x.role === 'admin') return null
  const pt = pot(x.team)
  if (x.passkey && !x.demoKey) {
    try {
      const ref = { passkey: x.passkey.publicKey } as T.KeyRef
      await T.revokeKey(ref).catch(() => {})
      const tx = await T.issueKey(ref, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
      x.keyTx = tx
      x.passkey = { ...x.passkey, tx, needsRefresh: false }
      return tx
    } catch {
      x.passkey = { ...x.passkey, needsRefresh: true }
      return null
    }
  }
  const oldVersion = x.keyVersion ?? 0
  if (x.keyTx) {
    await T.revokeKey({ pk: keyPk(x, oldVersion) }).catch(() => {})
    x.keyVersion = oldVersion + 1
  } else {
    x.keyVersion = oldVersion
  }
  const ref = { pk: keyPk(x) } as T.KeyRef
  const tx = await T.issueKey(ref, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  x.keyTx = tx
  x.demoKey = true
  return tx
}

async function issuePerkKey(p: Perk) {
  const tx = await T.issueKey({ pk: perkKeyPk(p.id) }, p.cap, p.periodSec, p.vendorIds.map((v) => vendor(v).address))
  p.keyTx = tx
  return tx
}

async function reissueTeamKeys(potId: string) {
  const members = S.people.filter((x) => x.team === potId && (x.demoKey || x.passkey))
  const receipts: string[] = []
  for (const member of members) receipts.push(await issuePotKey(member) ?? '')
  return receipts.filter(Boolean)
}

async function parseBody<T>(c: any, schema: z.ZodType<T>) {
  const body = await c.req.json().catch(() => ({}))
  return schema.parse(body)
}

type ViewerScope = { viewer?: Person; isAdmin: boolean }

function scopeFor(viewerId?: string | null): ViewerScope {
  if (!viewerId) return { isAdmin: true }
  const viewer = person(viewerId)
  return { viewer, isAdmin: viewer.role === 'admin' }
}

function canSeePerson(scope: ViewerScope, x: Person) {
  if (scope.isAdmin) return true
  const v = scope.viewer!
  if (x.id === v.id) return true
  return v.role === 'lead' && !!v.team && x.team === v.team
}

function canSeePot(scope: ViewerScope, potId?: string) {
  if (scope.isAdmin) return true
  if (!potId) return false
  return scope.viewer?.team === potId
}

function canSeeActivity(scope: ViewerScope, a: Activity) {
  if (scope.isAdmin) return true
  const v = scope.viewer!
  if (a.kind === 'payday') return a.who === v.id
  if (a.who === v.id) return true
  if (a.perkId && S.perks.some((p) => p.id === a.perkId && p.personId === v.id)) return true
  if (v.role === 'lead' && canSeePot(scope, a.potId)) return true
  return false
}

function scopedPaydayRuns(scope: ViewerScope) {
  if (scope.isAdmin) return S.paydayRuns
  const v = scope.viewer!
  return S.paydayRuns.flatMap((run) => {
    const line = run.lines.find((l) => l.personId === v.id)
    if (!line) return []
    return [{ ...run, total: line.gross, count: 1, lines: [line] }]
  })
}

function scopedActivity(scope: ViewerScope) {
  const base = S.activity.filter((a) => canSeeActivity(scope, a))
  if (scope.isAdmin) return base
  const v = scope.viewer!
  const payday = scopedPaydayRuns(scope).map((run): Activity => ({
    id: `payday-${run.id}-${v.id}`,
    at: run.at,
    kind: 'payday',
    title: `Payday's in the pot`,
    detail: `Your pay landed in ${(run.ms / 1000).toFixed(1)}s`,
    amount: run.total,
    tx: run.tx,
    who: v.id,
    memo: `payday:${run.date}`,
  }))
  return [...base, ...payday].sort((a, b) => b.at - a.at)
}

async function view(viewerId?: string | null) {
  const scope = scopeFor(viewerId)
  const visiblePeople = S.people.filter((x) => canSeePerson(scope, x))
  const people = await Promise.all(visiblePeople.map(async (x) => {
    const pt = x.team ? pot(x.team) : undefined
    const ref = keyRef(x)
    const [limit, balance] = await Promise.all([cachedRemaining(`pot:${x.id}:${x.team}:${x.keyTx ?? ''}`, ref), cachedBalance(x.address)])
    const canSeePrivateMoney = scope.isAdmin || scope.viewer?.id === x.id
    return {
      id: x.id, name: x.name, role: x.role, hasPasskey: !!x.passkey, passkeyId: x.passkey?.id, passkeyNeedsRefresh: !!x.passkey?.needsRefresh,
      title: x.title, team: x.team, salary: canSeePrivateMoney ? x.salary : undefined, country: x.country, balance: canSeePrivateMoney ? balance : 0,
      pot: pt ? { cap: pt.perPersonCap, left: limit?.remaining ?? null, resetsAt: limit?.periodEnd ?? null } : null,
    }
  }))
  const visiblePerks = scope.isAdmin ? S.perks : S.perks.filter((p) => p.personId === scope.viewer!.id)
  const perks = await Promise.all(visiblePerks.map(async (p) => {
    const limit = await cachedRemaining(`perk:${p.id}:${p.keyTx ?? ''}`, { pk: perkKeyPk(p.id) })
    return { ...p, left: limit?.remaining ?? null, resetsAt: limit?.periodEnd ?? null, vendors: p.vendorIds.map((v) => vendor(v).name) }
  }))
  const [companyBalance] = await Promise.all([cachedBalance(S.company.address)])
  const activity = scopedActivity(scope).slice(0, 100).map((a) => ({ ...a, memoLabel: decodeMemoLabel(a.memo), receipt: a.tx ? T.EXPLORER + a.tx : undefined }))
  const pots = S.pots.filter((p) => scope.isAdmin || p.id === scope.viewer?.team)
  const approvedForPot = (potId: string) => {
    if (scope.isAdmin || scope.viewer?.role === 'lead') return potApprovedTotal(S, potId)
    return S.held.filter((h) => h.potId === potId && h.personId === scope.viewer?.id && h.status === 'approved').reduce((a, h) => a + h.amount, 0)
  }
  const personIds = new Set(visiblePeople.map((p) => p.id))
  const visibleHeld = S.held.filter((h) => scope.isAdmin || (scope.viewer!.role === 'lead' ? h.potId === scope.viewer!.team : h.personId === scope.viewer!.id))
  const visibleInvoices = S.invoices.filter((i) => scope.isAdmin || i.contractorId === scope.viewer?.id)
  const visibleCloses = S.quarterCloses.filter((q) => scope.isAdmin || q.memberIds.includes(scope.viewer!.id) || q.potId === scope.viewer!.team)
  const visibleCredits = S.kudosCredits.filter((k) => scope.isAdmin || k.personId === scope.viewer!.id)
  const visibleAwards = S.kudosAwards.filter((k) => scope.isAdmin || k.fromPersonId === scope.viewer!.id || k.toPersonId === scope.viewer!.id || (scope.viewer!.role === 'lead' && (personIds.has(k.fromPersonId) || personIds.has(k.toPersonId))))
  return {
    company: { name: S.company.name, balance: scope.isAdmin ? companyBalance : 0 },
    nextPayday: S.nextPayday,
    people,
    pots: pots.map((p) => ({ ...p, approved: approvedForPot(p.id), vendors: p.vendorIds.map((v) => vendor(v).name), members: visiblePeople.filter((x) => x.team === p.id).map((x) => x.id) })),
    vendors: S.vendors.map(({ id, name, category }) => ({ id, name, category })),
    perks,
    activity,
    held: visibleHeld,
    invoices: visibleInvoices,
    paydayRuns: scopedPaydayRuns(scope),
    quarterCloses: visibleCloses,
    kudosCredits: visibleCredits,
    kudosAwards: visibleAwards,
    simulatedEarnings: { label: 'Simulated', amount: 1284, note: 'No public test vault is available, so this card is illustrative.' },
    seeded: S.seeded,
  }
}

export const app = new Hono()
app.onError((e: any, c) => {
  if (e instanceof ZodError) return c.json({ error: e.issues[0]?.message ?? 'Please check the form and try again' }, 400)
  return c.json({ error: e.message || 'Something went sideways', status: e.status ?? 500 }, e.status ?? 500)
})

let queue: Promise<unknown> = Promise.resolve()
app.use('/api/*', (c, next) => {
  const run = queue.then(async () => {
    S = normalizeState(await Store.load<State>(), seedState)
    await next()
    if (c.req.method === 'POST') { invalidateCache(); await Store.save(S) }
  })
  queue = run.catch(() => {})
  return run
})

app.get('/api/state', async (c) => c.json(await view(c.req.query('viewer'))))
app.get('/api/payday/preview', (c) => {
  const staff = S.people.filter((x) => x.salary)
  return c.json({ date: S.nextPayday, total: staff.reduce((s, x) => s + (x.salary ?? 0), 0), lines: staff.map((x) => ({ personId: x.id, name: x.name, title: x.title, gross: x.salary })) })
})

app.post('/api/setup', async (c) => {
  if (S.seeded) return c.json(await view())
  for (const x of S.people.filter((p) => p.demoKey)) {
    const tx = await issuePotKey(x)
    const pt = pot(x.team!)
    log({ kind: 'setup', title: `${x.name} joined the ${pt.team} pot`, detail: `$${pt.perPersonCap}/${pt.periodLabel} · ${pt.vendorIds.length} approved vendors`, tx: tx ?? undefined, potId: pt.id, who: x.id, memo: `setup:${pt.id}` })
  }
  for (const p of S.perks) {
    const tx = await issuePerkKey(p)
    log({ kind: 'perk', title: `${person(p.personId).name.split(' ')[0]} got ${p.name}`, detail: `$${p.cap}/${p.periodLabel} at ${p.vendorIds.map((v) => vendor(v).name).join(', ')}`, tx, who: p.personId, perkId: p.id, memo: `perk:${p.name}` })
  }
  S.seeded = true
  return c.json(await view())
})

app.post('/api/settings/payday', async (c) => {
  const body = await parseBody(c, z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  S.nextPayday = body.date
  log({ kind: 'admin', title: 'Next payday set', detail: body.date, memo: 'admin:payday-date' })
  return c.json({ ok: true, date: S.nextPayday })
})

app.post('/api/payday', async (c) => {
  const body = await parseBody(c, z.object({ requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const staff = S.people.filter((x) => x.salary)
  const date = S.nextPayday || new Date().toISOString().slice(0, 10)
  const r = await T.payday(staff.map((x) => ({ to: x.address, amount: x.salary!, note: `payday ${date}` })))
  const total = staff.reduce((s, x) => s + x.salary!, 0)
  const run = { id: uid(), at: Date.now(), date, tx: r.tx, total, count: staff.length, ms: r.ms, lines: staff.map((x) => ({ personId: x.id, gross: x.salary!, memo: `payday ${date}` })) }
  S.paydayRuns.unshift(run)
  S.nextPayday = nextMonthlyDate(new Date(`${date}T00:00:00Z`))
  log({ kind: 'payday', title: `Payday's in the pot`, detail: `${staff.length} people paid in ${(r.ms / 1000).toFixed(1)}s`, amount: total, tx: r.tx, memo: `payday:${date}` })
  const out = { ...r, total, count: staff.length, run }
  if (body.requestId) S.processed[body.requestId] = out
  return c.json(out)
})

app.post('/api/spend', async (c) => {
  const body = await parseBody(c, z.object({ personId: text(40), vendorId: text(60), amount: number, note: z.string().trim().max(60).optional().default(''), source: z.enum(['pot', 'perk']).optional().default('pot'), perkId: z.string().optional(), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const x = person(body.personId)
  const v = vendor(body.vendorId)
  const amount = roundMoney(body.amount)
  if (body.source === 'perk') {
    const p = perk(body.perkId ?? '')
    if (p.personId !== x.id) return c.json({ error: 'That perk belongs to someone else' }, 400)
    if (!p.vendorIds.includes(v.id)) return c.json({ error: `${v.name} is not on this perk yet` }, 400)
    const tx = await T.spendWithKey({ pk: perkKeyPk(p.id) }, v.address, amount, moneyMemo(`perk:${p.name}`))
    log({ kind: 'spend', title: `${x.name.split(' ')[0]} used ${p.name}`, detail: `${v.name} · ${body.note || v.category}`, amount, tx, who: x.id, perkId: p.id, memo: `perk:${p.name}` })
    const out = { ok: true, tx, receipt: T.EXPLORER + tx }
    if (body.requestId) S.processed[body.requestId] = out
    return c.json(out)
  }
  const pt = pot(x.team!)
  try {
    const tx = await T.spendWithKey({ pk: keyPk(x) }, v.address, amount, moneyMemo(`${pt.id}:${body.note || v.category}`))
    log({ kind: 'spend', title: `${x.name.split(' ')[0]} paid ${v.name}`, detail: `${pt.team} pot · ${body.note || v.category}`, amount, tx, who: x.id, potId: pt.id, memo: `${pt.id}:${body.note || v.category}` })
    const out = { ok: true, tx, receipt: T.EXPLORER + tx }
    if (body.requestId) S.processed[body.requestId] = out
    return c.json(out)
  } catch (e: any) {
    const out = { ok: false, held: hold(x, v, pt, amount, body.note), reason: String(e.shortMessage || e.message).split('\n')[0] }
    if (body.requestId) S.processed[body.requestId] = out
    return c.json(out)
  }
})

function hold(x: Person, v: Vendor, pt: Pot, amount: number, note: string) {
  const reason = holdReason(pt, v.id)
  const h: Held = { id: uid(), at: Date.now(), personId: x.id, potId: pt.id, vendorId: v.id, amount, note: note || v.category, reason, status: 'held' }
  S.held.unshift(h)
  log({ kind: 'held', title: `Held for approval: ${v.name}`, detail: reason === 'new-vendor' ? `${v.name} needs a lead's OK` : `Over ${x.name.split(' ')[0]}'s monthly limit`, amount, who: x.id, potId: pt.id, memo: `${pt.id}:held` })
  return h
}

app.post('/api/passkey/enroll', async (c) => {
  const body = await parseBody(c, z.object({ personId: text(40), id: text(200), publicKey: z.string().regex(/^0x[0-9a-fA-F]+$/) }))
  const x = person(body.personId)
  const pt = pot(x.team!)
  const tx = await T.issueKey({ passkey: body.publicKey as `0x${string}` }, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  if (x.demoKey && !x.passkey) await T.revokeKey({ pk: keyPk(x) }).catch(() => {})
  x.passkey = { id: body.id, publicKey: body.publicKey as `0x${string}`, tx }
  x.demoKey = false
  log({ kind: 'setup', title: `${x.name.split(' ')[0]} turned on Face ID`, detail: `Pays from the ${pt.team} pot with this device`, tx, who: x.id, potId: pt.id, memo: `setup:face` })
  return c.json({ ok: true })
})

app.get('/api/passkey/pay-info/:personId', (c) => {
  const x = person(c.req.param('personId'))
  return c.json({ company: S.company.address, token: T.TOKEN, credentialId: x.passkey?.id, publicKey: x.passkey?.publicKey, vendors: Object.fromEntries(S.vendors.map((v) => [v.id, v.address])), potId: x.team })
})

app.post('/api/passkey/record', async (c) => {
  const body = await parseBody(c, z.object({ personId: text(40), vendorId: text(60), amount: number, note: z.string().trim().max(60).optional().default(''), tx: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(), rejected: z.boolean().optional(), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const x = person(body.personId), v = vendor(body.vendorId), pt = pot(x.team!)
  if (body.rejected) return c.json({ ok: false, held: hold(x, v, pt, roundMoney(body.amount), body.note) })
  if (!body.tx) return c.json({ error: 'Missing receipt' }, 400)
  if (S.activity.some((a) => a.tx === body.tx)) return c.json({ error: 'Payment already recorded' }, 409)
  if (!(await T.verifySpend(body.tx as `0x${string}`, v.address, roundMoney(body.amount)))) return c.json({ error: 'Payment could not be confirmed' }, 400)
  log({ kind: 'spend', title: `${x.name.split(' ')[0]} paid ${v.name}`, detail: `${pt.team} pot · ${body.note || v.category} · Face ID`, amount: roundMoney(body.amount), tx: body.tx, who: x.id, potId: pt.id, memo: `${pt.id}:${body.note || v.category}` })
  const out = { ok: true, tx: body.tx, receipt: T.EXPLORER + body.tx }
  if (body.requestId) S.processed[body.requestId] = out
  return c.json(out)
})

app.post('/api/held/:id/:action', async (c) => {
  const h = requireOne(S.held.find((x) => x.id === c.req.param('id')), 'Held payment')
  const action = c.req.param('action')
  if (!['approve', 'approve-add', 'return'].includes(action)) return c.json({ error: 'Unknown decision' }, 400)
  const body = await parseBody(c, z.object({ requestId, approverId: z.string().optional() }).optional().default({}))
  const idem = body.requestId
  if (idem && S.processed[idem]) return c.json(S.processed[idem])
  if (h.status !== 'held') return c.json(h)
  // Finance can decide anything; a lead can decide their own team's requests, but never their own.
  const approver = body.approverId ? S.people.find((x) => x.id === body.approverId) : undefined
  if (!approver) return c.json({ error: 'Who is deciding? Pick Finance or the team lead.' }, 400)
  const canDecide = approver.role === 'admin' || (approver.role === 'lead' && approver.team === h.potId && approver.id !== h.personId)
  if (!canDecide) return c.json({ error: approver.id === h.personId ? "You can't approve your own request. Finance will take it from here." : "Only Finance or this team's lead can decide this." }, 403)
  if (action === 'approve' || action === 'approve-add') {
    const v = vendor(h.vendorId)
    h.tx = await T.companyPay(v.address, h.amount, moneyMemo(`${h.potId}:approved`))
    h.status = 'approved'
    if (action === 'approve-add') {
      const pt = pot(h.potId)
      if (!pt.vendorIds.includes(v.id)) pt.vendorIds.push(v.id)
      const receipts = await reissueTeamKeys(pt.id)
      log({ kind: 'admin', title: `${v.name} added to ${pt.team}`, detail: `Updated ${receipts.length} team cards`, tx: receipts[0], potId: pt.id, memo: `${pt.id}:vendor` })
    }
    log({ kind: 'approved', title: `Approved: ${v.name}`, detail: `Paid by ${S.company.name} · counts toward the ${pot(h.potId).team} pot`, amount: h.amount, tx: h.tx, who: h.personId, potId: h.potId, memo: `${h.potId}:approved` })
  } else {
    h.status = 'returned'
    log({ kind: 'returned', title: `Returned: ${vendor(h.vendorId).name}`, detail: 'Nothing was paid', amount: h.amount, who: h.personId, potId: h.potId, memo: `${h.potId}:returned` })
  }
  if (idem) S.processed[idem] = h
  return c.json(h)
})

app.post('/api/vendors', async (c) => {
  const body = await parseBody(c, z.object({ name: text(80), category: text(40) }))
  if (S.vendors.some((v) => v.name.toLowerCase() === body.name.toLowerCase())) return c.json({ error: 'That vendor is already here' }, 409)
  const v: Vendor = { id: slug(body.name), name: body.name, category: body.category, address: T.newAddress() }
  S.vendors.push(v)
  log({ kind: 'admin', title: `${v.name} added`, detail: v.category, memo: 'admin:vendor' })
  return c.json(v)
})

app.post('/api/people', async (c) => {
  const body = await parseBody(c, z.object({ name: text(80), role: z.enum(['admin', 'lead', 'employee', 'contractor']), title: text(80), team: z.string().optional(), salary: optionalNumber, country: z.string().optional() }))
  if (body.team) pot(body.team)
  const p: Person = { id: slug(body.name), name: body.name, role: body.role, title: body.title, team: body.team, salary: body.salary, country: body.country, address: T.newAddress(), demoKey: body.role === 'lead' || body.role === 'employee' }
  S.people.push(p)
  if (S.seeded && p.demoKey) await issuePotKey(p)
  log({ kind: 'admin', title: `${p.name} joined`, detail: p.title, who: p.id, memo: 'admin:person' })
  return c.json(p)
})

app.post('/api/people/:id/update', async (c) => {
  const p = person(c.req.param('id'))
  const body = await parseBody(c, z.object({ name: text(80).optional(), role: z.enum(['admin', 'lead', 'employee', 'contractor']).optional(), title: text(80).optional(), team: z.string().optional(), salary: optionalNumber, country: z.string().optional() }))
  const keyAffects = body.team !== undefined && body.team !== p.team
  if (body.team) pot(body.team)
  Object.assign(p, body)
  if (keyAffects && S.seeded && p.demoKey) await issuePotKey(p)
  log({ kind: 'admin', title: `${p.name} updated`, detail: keyAffects ? `Updating ${p.name.split(' ')[0]}'s card` : 'Profile saved', who: p.id, memo: 'admin:person' })
  return c.json(p)
})

app.post('/api/pots', async (c) => {
  const body = await parseBody(c, z.object({ team: text(60), perPersonCap: number, vendorIds: z.array(z.string()).min(1), color: z.string().optional() }))
  body.vendorIds.forEach((id) => vendor(id))
  const pt: Pot = { id: slug(body.team), team: body.team, perPersonCap: roundMoney(body.perPersonCap), periodLabel: 'month', periodSec: MONTH, vendorIds: body.vendorIds, color: body.color || colors[S.pots.length % colors.length] }
  S.pots.push(pt)
  log({ kind: 'admin', title: `${pt.team} pot created`, detail: `$${pt.perPersonCap}/month`, potId: pt.id, memo: 'admin:pot' })
  return c.json(pt)
})

app.post('/api/pots/:id/update', async (c) => {
  const pt = pot(c.req.param('id'))
  const body = await parseBody(c, z.object({ team: text(60).optional(), perPersonCap: number.optional(), vendorIds: z.array(z.string()).optional(), color: z.string().optional() }))
  if (body.vendorIds) body.vendorIds.forEach((id) => vendor(id))
  const keyAffects = body.perPersonCap !== undefined || body.vendorIds !== undefined
  Object.assign(pt, { ...body, perPersonCap: body.perPersonCap ? roundMoney(body.perPersonCap) : pt.perPersonCap })
  const receipts = keyAffects && S.seeded ? await reissueTeamKeys(pt.id) : []
  log({ kind: 'admin', title: `${pt.team} pot updated`, detail: keyAffects ? `Updated ${receipts.length} team cards` : 'Saved', tx: receipts[0], potId: pt.id, memo: 'admin:pot' })
  return c.json({ ...pt, reissued: receipts.length })
})

app.post('/api/perks', async (c) => {
  const body = await parseBody(c, z.object({ personId: text(40), name: text(60), cap: number, periodLabel: z.enum(['day', 'month', 'year']), vendorIds: z.array(z.string()).min(1), color: z.string().optional() }))
  const p = person(body.personId)
  body.vendorIds.forEach((id) => vendor(id))
  const periodSec = body.periodLabel === 'day' ? DAY : body.periodLabel === 'year' ? YEAR : MONTH
  const perk: Perk = { id: slug(`${p.id}-${body.name}`), personId: p.id, name: body.name, cap: roundMoney(body.cap), periodLabel: body.periodLabel, periodSec, vendorIds: body.vendorIds, color: body.color || '#C8D69B' }
  S.perks.push(perk)
  if (S.seeded) await issuePerkKey(perk)
  log({ kind: 'perk', title: `${p.name.split(' ')[0]} got ${perk.name}`, detail: `$${perk.cap}/${perk.periodLabel}`, who: p.id, perkId: perk.id, tx: perk.keyTx, memo: `perk:${perk.name}` })
  return c.json(perk)
})

app.post('/api/pots/:id/close', async (c) => {
  const pt = pot(c.req.param('id'))
  const body = await parseBody(c, z.object({ sharePct: z.coerce.number().min(0).max(100).default(20), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const members = S.people.filter((p) => p.team === pt.id)
  const limits = await Promise.all(members.map((m) => cachedRemaining(`pot:${m.id}:${m.team}:${m.keyTx ?? ''}`, keyRef(m))))
  const savings = potSavings(limits.map((l) => l?.remaining ?? 0), potApprovedTotal(S, pt.id))
  const split = splitKudos(savings, body.sharePct, members.map((m) => m.id))
  if (split.pool <= 0) return c.json({ error: 'No savings to share this time' }, 400)
  const r = await T.payday(split.lines.map((l) => ({ to: person(l.personId).address, amount: l.amount, note: `kudos ${pt.team}` })))
  const close = { id: uid(), at: Date.now(), potId: pt.id, savings, sharePct: body.sharePct, pool: split.pool, perPerson: split.perPerson, tx: r.tx, memberIds: members.map((m) => m.id) }
  S.quarterCloses.unshift(close)
  for (const line of split.lines) S.kudosCredits.push({ personId: line.personId, closeId: close.id, left: line.amount })
  log({ kind: 'quarter', title: `${pt.team} saved $${roundMoney(savings).toLocaleString('en-US')}`, detail: `${body.sharePct}% became a kudos pool`, amount: split.pool, tx: r.tx, potId: pt.id, memo: `kudos:${pt.id}` })
  if (body.requestId) S.processed[body.requestId] = close
  return c.json(close)
})

app.post('/api/kudos', async (c) => {
  const body = await parseBody(c, z.object({ fromPersonId: text(40), toPersonId: text(40), amount: number, note: text(80), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const from = person(body.fromPersonId), to = person(body.toPersonId)
  if (from.id === to.id) return c.json({ error: 'Pick a teammate' }, 400)
  const check = canAwardKudos(S.kudosCredits, from.id, roundMoney(body.amount))
  if (!check.ok) return c.json({ error: `Only $${check.left.toFixed(2)} left to award` }, 400)
  const tx = await T.companyPay(to.address, roundMoney(body.amount), moneyMemo(`kudos:${body.note}`))
  applyKudosDebit(S.kudosCredits, from.id, roundMoney(body.amount))
  const award = { id: uid(), at: Date.now(), fromPersonId: from.id, toPersonId: to.id, amount: roundMoney(body.amount), note: body.note, tx }
  S.kudosAwards.unshift(award)
  log({ kind: 'kudos', title: `${from.name.split(' ')[0]} sent kudos to ${to.name.split(' ')[0]}`, detail: body.note, amount: award.amount, tx, who: to.id, potId: to.team, memo: `kudos:${body.note}` })
  if (body.requestId) S.processed[body.requestId] = award
  return c.json(award)
})

app.post('/api/invoices', async (c) => {
  const body = await parseBody(c, z.object({ contractorId: text(40), amount: number, description: text(120), requestId }))
  const contractor = person(body.contractorId)
  if (contractor.role !== 'contractor') return c.json({ error: 'Invoices are for contractors' }, 400)
  const inv: Invoice = { id: uid(), number: invoiceNumber(S.invoices), at: Date.now(), contractorId: contractor.id, amount: roundMoney(body.amount), description: body.description, status: 'submitted' }
  S.invoices.unshift(inv)
  log({ kind: 'invoice', title: `${contractor.name} sent ${inv.number}`, detail: body.description, amount: inv.amount, who: contractor.id, memo: `invoice:${inv.number}` })
  return c.json(inv)
})

app.post('/api/invoices/:id/pay', async (c) => {
  const inv = requireOne(S.invoices.find((x) => x.id === c.req.param('id')), 'Invoice')
  const body = await parseBody(c, z.object({ requestId }).optional().default({}))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  if (inv.status === 'paid') return c.json(inv)
  if (inv.status === 'declined') return c.json({ error: 'This invoice was declined' }, 409)
  const t0 = Date.now()
  inv.tx = await T.companyPay(person(inv.contractorId).address, inv.amount, inv.number)
  inv.paidMs = Date.now() - t0
  inv.status = 'paid'
  log({ kind: 'paid', title: `${person(inv.contractorId).name} paid · ${inv.number}`, detail: `Paid in ${(inv.paidMs / 1000).toFixed(1)}s`, amount: inv.amount, tx: inv.tx, who: inv.contractorId, memo: `invoice:${inv.number}` })
  if (body.requestId) S.processed[body.requestId] = inv
  return c.json(inv)
})

app.post('/api/invoices/:id/decline', async (c) => {
  const inv = requireOne(S.invoices.find((x) => x.id === c.req.param('id')), 'Invoice')
  const body = await parseBody(c, z.object({ reason: text(120), requestId }))
  if (inv.status !== 'submitted') return c.json(inv)
  inv.status = 'declined'
  inv.declineReason = body.reason
  log({ kind: 'declined', title: `${inv.number} declined`, detail: body.reason, amount: inv.amount, who: inv.contractorId, memo: `invoice:${inv.number}` })
  return c.json(inv)
})

app.get('/api/receipts/:id', (c) => {
  const scope = scopeFor(c.req.query('viewer'))
  const a = requireOne(S.activity.find((x) => x.id === c.req.param('id')) ?? scopedActivity(scope).find((x) => x.id === c.req.param('id')), 'Receipt')
  if (!canSeeActivity(scope, a)) return c.json({ error: 'Receipt not found' }, 404)
  const who = a.who ? S.people.find((p) => p.id === a.who) : undefined
  const pt = a.potId ? S.pots.find((p) => p.id === a.potId) : undefined
  return c.json({ ...a, whoName: who?.name, potName: pt?.team, memoLabel: decodeMemoLabel(a.memo), publicRecord: a.tx ? T.EXPLORER + a.tx : undefined })
})

app.get('/api/activity.csv', (c) => {
  const scope = scopeFor(c.req.query('viewer'))
  const rows = [['date', 'kind', 'title', 'detail', 'amount', 'person', 'pot', 'receipt']]
  for (const a of scopedActivity(scope)) rows.push([new Date(a.at).toISOString(), a.kind, a.title, a.detail, a.amount?.toString() ?? '', a.who ? person(a.who).name : '', a.potId ? pot(a.potId).team : '', a.tx ? T.EXPLORER + a.tx : ''])
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  return c.text(rows.map((r) => r.map(esc).join(',')).join('\n'), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="teampot-activity.csv"' })
})

app.post('/api/reset', (c) => {
  const need = process.env.RESET_TOKEN
  if (need && c.req.header('x-reset-token') !== need) return c.json({ error: 'Not allowed' }, 403)
  S = seedState()
  invalidateCache()
  return c.json({ ok: true })
})
