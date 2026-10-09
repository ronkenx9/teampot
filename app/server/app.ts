import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { PublicKey, Signature, WebAuthnP256 } from 'ox'
import * as T from './tempo.js'
import * as Store from './store.js'
import {
  DAY, MONTH, YEAR, applyKudosDebit, canAwardKudos, decodeMemoLabel, holdReason, idempotent, invoiceNumber,
  moneyMemo, nextMonthlyDate, normalizeState, potApprovedTotal, potSavings, roundMoney, slug, splitKudos, uid,
  type Activity, type AuthChallenge, type Held, type Invite, type Invoice, type Perk, type Person, type Pot, type Session, type State, type Vendor,
} from './domain.js'

const colors = ['#E8552D', '#141414', '#6F6A63', '#B8401C']
const number = z.coerce.number().finite().positive()
const optionalNumber = z.coerce.number().finite().nonnegative().optional()
const text = (max = 120) => z.string().trim().min(1).max(max)
const requestId = z.string().trim().min(6).max(120).optional()
const SESSION_COOKIE = 'tp_session'
const DAY_MS = 86400_000
const authError = (message = 'Sign in required') => {
  const e: any = new Error(message)
  e.status = 401
  return e
}
const forbidden = (message = 'Not allowed') => {
  const e: any = new Error(message)
  e.status = 403
  return e
}
// Secrets (session ids, invite tokens) are stored only as hashes: state lives in blob storage.
const hashSecret = (raw: string) => createHash('sha256').update(raw).digest('hex')
// Demo sign-in is only for the seeded demo company, and can be switched off with DEMO_MODE=off.
const DEMO_PEOPLE = new Set(['jordan', 'ava', 'sam', 'priya', 'leo', 'mateo', 'yuki'])
const demoAllowed = (personId: string) => process.env.DEMO_MODE !== 'off' && DEMO_PEOPLE.has(personId)
/** The assertion must come from this site: clientData origin matches the request origin and the authenticator's rpIdHash matches this host. */
function assertionFromThisSite(c: any, metadata: any) {
  try {
    const url = new URL(c.req.url)
    const origin = c.req.header('origin') || url.origin
    const host = new URL(origin).hostname
    const client = JSON.parse(String(metadata?.clientDataJSON ?? ''))
    if (client.type !== 'webauthn.get' || client.origin !== origin || host !== (c.req.header('x-forwarded-host') || url.hostname).split(':')[0]) return false
    const auth = Buffer.from(String(metadata?.authenticatorData ?? '').replace(/^0x/, ''), 'hex')
    return auth.length >= 37 && auth.subarray(0, 32).equals(createHash('sha256').update(host).digest())
  } catch { return false }
}
const randomHex = (bytes = 32) => `0x${randomBytes(bytes).toString('hex')}` as `0x${string}`
const rateBuckets = new Map<string, { count: number; resetAt: number }>()
function rateLimit(c: any, bucket: string, max = 20, windowMs = 60_000) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const key = `${bucket}:${ip}`
  const t = now()
  const current = rateBuckets.get(key)
  if (!current || current.resetAt < t) {
    rateBuckets.set(key, { count: 1, resetAt: t + windowMs })
    return
  }
  current.count += 1
  if (current.count > max) {
    const e: any = new Error('Too many tries. Wait a minute and try again.')
    e.status = 429
    throw e
  }
}

function seedState(): State {
  const v = (name: string, category: string): Vendor => ({ id: slug(name), name, category, address: T.newAddress() })
  const vendors = [v('Figma', 'Software'), v('Adobe Fonts', 'Software'), v('AWS', 'Cloud'), v('Notion', 'Software'), v('Delta', 'Travel'), v('Uber Eats', 'Meals'), v('Linear', 'Software'), v('PixelVault Stock', 'Assets'), v('Udemy', 'Learning')]
  const id = (n: string) => vendors.find((x) => x.name === n)!.id
  const pots: Pot[] = [
    { id: 'design', team: 'Design', perPersonCap: 600, budget: 3600, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Figma'), id('Adobe Fonts'), id('Notion'), id('Uber Eats')], color: '#E8552D', rootMode: 'demo-server-p256' },
    { id: 'eng', team: 'Engineering', perPersonCap: 1500, budget: 6000, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('AWS'), id('Linear'), id('Notion'), id('Uber Eats')], color: '#141414', rootMode: 'demo-server-p256' },
    { id: 'mkt', team: 'Marketing', perPersonCap: 900, budget: 3600, periodLabel: 'month', periodSec: MONTH, vendorIds: [id('Delta'), id('Notion'), id('Uber Eats')], color: '#6F6A63', rootMode: 'demo-server-p256' },
  ]
  const p = (name: string, role: Person['role'], title: string, team?: string, salary?: number, country?: string): Person =>
    ({ id: name.toLowerCase().split(' ')[0], name, role, title, team, salary, country, address: T.newAddress(), demoKey: role === 'lead' || role === 'employee' })
  const people = [
    p('Jordan Lee', 'admin', 'Head of Finance'),
    p('Ava Chen', 'lead', 'Design Lead', 'design', 4200),
    p('Sam Okafor', 'employee', 'Product Designer', 'design', 3600),
    p('Priya Nair', 'employee', 'Software Engineer', 'eng', 4800),
    p('Leo Martin', 'employee', 'Growth Marketer', 'mkt', 3900),
    p('Mateo Ruiz', 'contractor', 'Illustrator', 'design', undefined, 'Mexico'),
    p('Yuki Tanaka', 'contractor', 'Copywriter', 'mkt', undefined, 'Japan'),
  ]
  const perks: Perk[] = [
    { id: 'sam-lunch', personId: 'sam', name: 'Lunch', cap: 15, periodLabel: 'day', periodSec: DAY, vendorIds: [id('Uber Eats')], color: '#E8552D' },
    { id: 'sam-learning', personId: 'sam', name: 'Learning', cap: 1500, periodLabel: 'year', periodSec: YEAR, vendorIds: [id('Udemy')], color: '#141414' },
    { id: 'ava-lunch', personId: 'ava', name: 'Lunch', cap: 15, periodLabel: 'day', periodSec: DAY, vendorIds: [id('Uber Eats')], color: '#E8552D' },
  ]
  return {
    version: 0,
    epoch: uid(),
    company: { name: 'Northwind Studio', address: T.companyAccount.address, financeApprovalThreshold: 1000 },
    people, vendors, pots, perks,
    activity: [], held: [], invoices: [], paydayRuns: [], quarterCloses: [], kudosCredits: [], kudosAwards: [],
    nextPayday: nextMonthlyDate(), processed: {}, sessions: [], authChallenges: [], invites: [], seeded: false,
  }
}

let S: State
const log = (a: Omit<Activity, 'id' | 'at'>) => { S.activity.unshift({ id: uid(), at: Date.now(), ...a }) }
const keyPk = (x: Person, version = x.keyVersion ?? 0) => T.derivedKeyPk(S.epoch, x.id, `pot:${x.team ?? 'none'}:${version}`)
const perkKeyPk = (perkId: string) => T.derivedKeyPk(S.epoch, perkId, 'perk')
const deptRootPk = (potId: string) => T.derivedDepartmentRootPk(S.epoch, potId)
const deptRoot = (potId: string) => T.rootFromPk(deptRootPk(potId))
const deptAddress = (potId: string) => T.p256RootAddress(deptRootPk(potId))
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

type Actor = { person: Person; session: Session; demo: boolean }
const now = () => Date.now()
const cleanEphemeral = () => {
  const t = now()
  S.sessions = S.sessions.filter((s) => s.expiresAt > t)
  S.authChallenges = S.authChallenges.filter((x) => x.expiresAt > t)
  S.invites = S.invites.filter((x) => !x.usedAt || x.expiresAt > t)
}
const cookieValue = (raw: string | undefined, name: string) =>
  raw?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1)
const setSessionCookie = (c: any, id: string, maxAge = 7 * DAY_MS / 1000) => {
  const secure = c.req.url.startsWith('https://') ? '; Secure' : ''
  c.header('set-cookie', `${SESSION_COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge)}${secure}`)
}
const clearSessionCookie = (c: any) => c.header('set-cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
// Sessions are self-contained signed tokens (HMAC-SHA256 with a key derived from the server secret), so any
// server instance can verify them without shared storage. Logout adds the token's id to a revocation list.
const sessionKey = () => createHash('sha256').update(`teampot-session:${process.env.SESSION_SECRET || process.env.OPERATOR_PK || 'dev'}`).digest()
const b64 = (x: string | Buffer) => Buffer.from(x).toString('base64url')
function createSession(personId: string, demo: boolean) {
  const session: Session = { id: randomHex(12), personId, demo, createdAt: now(), expiresAt: now() + (demo ? 2 : 7) * DAY_MS }
  const body = b64(JSON.stringify(session))
  const sig = b64(createHmac('sha256', sessionKey()).update(body).digest())
  return { ...session, id: `${body}.${sig}` } // cookie value; nothing secret is stored server-side
}
function readSession(token: string | undefined): Session | undefined {
  if (!token || !token.includes('.')) return undefined
  const [body, sig] = token.split('.')
  const want = createHmac('sha256', sessionKey()).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return undefined
  try {
    const sess = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Session
    if (sess.expiresAt <= now() || S.revokedSessions?.includes(sess.id)) return undefined
    return sess
  } catch { return undefined }
}
function actorFrom(c: any): Actor {
  const sid = cookieValue(c.req.header('cookie'), SESSION_COOKIE)
  const session = readSession(sid)
  if (!session) throw authError()
  const p = person(session.personId)
  if (p.removed) throw authError('This access has been removed')
  return { person: p, session, demo: session.demo }
}
function optionalActor(c: any): Actor | null {
  try { return actorFrom(c) } catch { return null }
}
const isFinance = (a: Actor) => a.person.role === 'admin'
const isHeadOf = (a: Actor, potId?: string) => a.person.role === 'lead' && !!potId && a.person.team === potId
const requireFinance = (a: Actor) => { if (!isFinance(a)) throw forbidden('Only Finance can do this'); return a }
const requireFinanceOrHead = (a: Actor, potId?: string) => { if (!isFinance(a) && !isHeadOf(a, potId)) throw forbidden('Only Finance or this department head can do this'); return a }
const requireSelf = (a: Actor, personId: string) => { if (!isFinance(a) && a.person.id !== personId) throw forbidden('This belongs to another person'); return a }
const canInviteFor = (a: Actor, role: Person['role'], team?: string) => isFinance(a) || (a.person.role === 'lead' && team === a.person.team && role !== 'admin')
const safeLog = (c: any, e: any) => {
  const status = e.status ?? 500
  if (status < 500) return
  console.error(JSON.stringify({ level: 'error', path: c.req.path, method: c.req.method, status, code: e.code, message: e.message }))
}

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
async function cachedRemaining(label: string, ref: T.KeyRef | null, source = T.companyAccount) {
  if (!ref || !S.seeded) return null
  const hit = fresh(cache.limit.get(label)); if (hit) return hit
  const value = await T.remainingOn(source, ref).catch(() => null)
  if (value) cache.limit.set(label, { at: Date.now(), value })
  return value
}

async function issuePotKey(x: Person) {
  if (!x.team || x.role === 'contractor' || x.role === 'admin') return null
  const pt = pot(x.team)
  const source = deptRoot(pt.id)
  if (x.passkey && !x.demoKey) {
    try {
      const ref = { passkey: x.passkey.publicKey } as T.KeyRef
      await T.revokeKeyOn(source, ref).catch(() => {})
      const tx = await T.issueKeyOn(source, ref, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
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
    await T.revokeKeyOn(source, { pk: keyPk(x, oldVersion) }).catch(() => {})
    x.keyVersion = oldVersion + 1
  } else {
    x.keyVersion = oldVersion
  }
  const ref = { pk: keyPk(x) } as T.KeyRef
  const tx = await T.issueKeyOn(source, ref, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  x.keyTx = tx
  x.demoKey = true
  return tx
}

async function issuePerkKey(p: Perk) {
  const owner = person(p.personId)
  const tx = await T.issueKeyOn(deptRoot(owner.team!), { pk: perkKeyPk(p.id) }, p.cap, p.periodSec, p.vendorIds.map((v) => vendor(v).address))
  p.keyTx = tx
  return tx
}

async function reissueTeamKeys(potId: string) {
  const members = S.people.filter((x) => x.team === potId && (x.demoKey || x.passkey))
  const receipts: string[] = []
  for (const member of members) receipts.push(await issuePotKey(member) ?? '')
  return receipts.filter(Boolean)
}

async function fundDepartment(pt: Pot, amount = pt.budget) {
  if (amount <= 0) return null
  const tx = await T.companyPay(deptAddress(pt.id), amount, moneyMemo(`fund ${pt.team}`))
  pt.fundTx = tx
  log({ kind: 'setup', title: `${pt.team} funded`, detail: `Finance sent ${roundMoney(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`, amount, tx, potId: pt.id, memo: `${pt.id}:fund` })
  return tx
}

async function parseBody<T>(c: any, schema: z.ZodType<T>) {
  const body = await c.req.json().catch(() => ({}))
  return schema.parse(body)
}

type ViewerScope = { viewer: Person; isAdmin: boolean; demo: boolean }

function scopeFor(actor: Actor): ViewerScope {
  const viewer = actor.person
  return { viewer, isAdmin: viewer.role === 'admin', demo: actor.demo }
}

function canSeePerson(scope: ViewerScope, x: Person) {
  if (scope.isAdmin) return true
  const v = scope.viewer
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
  const v = scope.viewer
  if (a.kind === 'payday') return a.who === v.id
  if (a.who === v.id) return true
  if (a.perkId && S.perks.some((p) => p.id === a.perkId && p.personId === v.id)) return true
  if (v.role === 'lead' && canSeePot(scope, a.potId)) return true
  return false
}

function scopedPaydayRuns(scope: ViewerScope) {
  if (scope.isAdmin) return S.paydayRuns
  const v = scope.viewer
  return S.paydayRuns.flatMap((run) => {
    const line = run.lines.find((l) => l.personId === v.id)
    if (!line) return []
    return [{ ...run, total: line.gross, count: 1, lines: [line] }]
  })
}

function scopedActivity(scope: ViewerScope) {
  const base = S.activity.filter((a) => canSeeActivity(scope, a))
  if (scope.isAdmin) return base
  const v = scope.viewer
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

async function view(_viewerId: string | null | undefined, actor: Actor) {
  const scope = scopeFor(actor)
  const visiblePeople = S.people.filter((x) => canSeePerson(scope, x))
  const people = await Promise.all(visiblePeople.map(async (x) => {
    const pt = x.team ? pot(x.team) : undefined
    const ref = keyRef(x)
    const [limit, balance] = await Promise.all([cachedRemaining(`pot:${x.id}:${x.team}:${x.keyTx ?? ''}`, ref, x.team ? deptRoot(x.team) : T.companyAccount), cachedBalance(x.address)])
    const canSeePrivateMoney = scope.isAdmin || scope.viewer.id === x.id
    return {
      id: x.id, name: x.name, role: x.role, hasPasskey: !!x.passkey, passkeyId: x.passkey?.id, passkeyNeedsRefresh: !!x.passkey?.needsRefresh,
      title: x.title, team: x.team, salary: canSeePrivateMoney ? x.salary : undefined, country: x.country, balance: canSeePrivateMoney ? balance : 0,
      pot: pt ? { cap: pt.perPersonCap, left: limit?.remaining ?? null, resetsAt: limit?.periodEnd ?? null } : null,
    }
  }))
  const visiblePerks = scope.isAdmin ? S.perks : S.perks.filter((p) => p.personId === scope.viewer.id)
  const perks = await Promise.all(visiblePerks.map(async (p) => {
    const owner = person(p.personId)
    const limit = await cachedRemaining(`perk:${p.id}:${p.keyTx ?? ''}`, { pk: perkKeyPk(p.id) }, owner.team ? deptRoot(owner.team) : T.companyAccount)
    return { ...p, left: limit?.remaining ?? null, resetsAt: limit?.periodEnd ?? null, vendors: p.vendorIds.map((v) => vendor(v).name) }
  }))
  const [companyBalance, departmentBalances] = await Promise.all([
    cachedBalance(S.company.address),
    Promise.all(S.pots.map(async (p) => [p.id, await cachedBalance(deptAddress(p.id))] as const)),
  ])
  const departmentBalanceById = Object.fromEntries(departmentBalances)
  const activity = scopedActivity(scope).slice(0, 100).map((a) => ({ ...a, memoLabel: decodeMemoLabel(a.memo), receipt: a.tx ? T.EXPLORER + a.tx : undefined }))
  const pots = S.pots.filter((p) => scope.isAdmin || p.id === scope.viewer.team)
  const approvedForPot = (potId: string) => {
    if (scope.isAdmin || scope.viewer?.role === 'lead') return potApprovedTotal(S, potId)
    return S.held.filter((h) => h.potId === potId && h.personId === scope.viewer.id && h.status === 'approved').reduce((a, h) => a + h.amount, 0)
  }
  const personIds = new Set(visiblePeople.map((p) => p.id))
  const visibleHeld = S.held.filter((h) => scope.isAdmin || (scope.viewer.role === 'lead' ? h.potId === scope.viewer.team : h.personId === scope.viewer.id))
  const visibleInvoices = S.invoices.filter((i) => scope.isAdmin || i.contractorId === scope.viewer.id || (scope.viewer.role === 'lead' && person(i.contractorId).team === scope.viewer.team))
  const visibleCloses = S.quarterCloses.filter((q) => scope.isAdmin || q.memberIds.includes(scope.viewer.id) || q.potId === scope.viewer.team)
  const visibleCredits = S.kudosCredits.filter((k) => scope.isAdmin || k.personId === scope.viewer.id)
  const visibleAwards = S.kudosAwards.filter((k) => scope.isAdmin || k.fromPersonId === scope.viewer.id || k.toPersonId === scope.viewer.id || (scope.viewer.role === 'lead' && (personIds.has(k.fromPersonId) || personIds.has(k.toPersonId))))
  return {
    auth: { personId: actor.person.id, role: actor.person.role, demo: actor.demo },
    company: { name: S.company.name, balance: scope.isAdmin ? companyBalance : 0, financeApprovalThreshold: S.company.financeApprovalThreshold },
    nextPayday: S.nextPayday,
    people,
    pots: pots.map((p) => ({ ...p, balance: scope.isAdmin || scope.viewer.team === p.id ? departmentBalanceById[p.id] ?? 0 : 0, accountMode: p.rootMode ?? 'demo-server-p256', approved: approvedForPot(p.id), vendors: p.vendorIds.map((v) => vendor(v).name), members: visiblePeople.filter((x) => x.team === p.id).map((x) => x.id) })),
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
  safeLog(c, e)
  if (e instanceof ZodError) return c.json({ error: e.issues[0]?.message ?? 'Please check the form and try again' }, 400)
  return c.json({ error: e.message || 'Something went sideways', status: e.status ?? 500 }, e.status ?? 500)
})

let queue: Promise<unknown> = Promise.resolve()
app.use('/api/*', (c, next) => {
  const run = queue.then(async () => {
    S = normalizeState(await Store.load<State>(), seedState)
    const baseVersion = S.version
    cleanEphemeral()
    await next()
    if (c.req.method === 'POST') { invalidateCache(); S.version = baseVersion + 1; await Store.save(S, baseVersion) }
  })
  queue = run.catch(() => {})
  return run
})

app.get('/api/health', (c) => c.json({ ok: true, service: 'teampot', version: S.version }))

app.post('/api/auth/demo', async (c) => {
  rateLimit(c, 'demo', 40)
  const body = await parseBody(c, z.object({ personId: text(40).default('jordan') }))
  const p = person(body.personId)
  if (!demoAllowed(p.id)) return c.json({ error: 'Demo sign-in is only for the demo company. Sign in with Face ID.' }, 403)
  const session = createSession(p.id, true)
  setSessionCookie(c, session.id, 2 * DAY_MS / 1000)
  return c.json({ ok: true, demo: true, personId: p.id })
})

app.post('/api/auth/logout', (c) => {
  const sid = cookieValue(c.req.header('cookie'), SESSION_COOKIE)
  if (sid) { const sess = readSession(sid); if (sess) S.revokedSessions = [...(S.revokedSessions ?? []), sess.id].slice(-500) }
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.post('/api/auth/challenge', async (c) => {
  rateLimit(c, 'signin', 10)
  const body = await parseBody(c, z.object({ personId: text(40) }))
  const p = person(body.personId)
  if (!p.passkey || p.passkey.needsRefresh) return c.json({ error: 'Set up Face ID before signing in' }, 409)
  const challenge: AuthChallenge = { id: uid(), personId: p.id, challenge: randomHex(32), createdAt: now(), expiresAt: now() + 5 * 60_000 }
  S.authChallenges.push(challenge)
  return c.json({ id: challenge.id, challenge: challenge.challenge, credentialId: p.passkey.id })
})

app.post('/api/auth/verify', async (c) => {
  rateLimit(c, 'signin', 10)
  const body = await parseBody(c, z.object({
    personId: text(40),
    challengeId: text(40),
    metadata: z.any(),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  }))
  const p = person(body.personId)
  const ch = S.authChallenges.find((x) => x.id === body.challengeId && x.personId === p.id && x.expiresAt > now())
  if (!ch || !p.passkey) throw authError('Sign-in challenge expired')
  if (!assertionFromThisSite(c, body.metadata)) throw authError('Face ID could not be verified')
  const ok = WebAuthnP256.verify({
    challenge: ch.challenge,
    metadata: body.metadata,
    publicKey: PublicKey.fromHex(p.passkey.publicKey),
    signature: Signature.fromHex(body.signature as `0x${string}`) as any,
  })
  if (!ok) throw authError('Face ID could not be verified')
  S.authChallenges = S.authChallenges.filter((x) => x.id !== ch.id)
  const session = createSession(p.id, false)
  setSessionCookie(c, session.id)
  return c.json({ ok: true, personId: p.id })
})

app.get('/api/me', (c) => {
  const a = optionalActor(c)
  return c.json(a ? { signedIn: true, demo: a.demo, personId: a.person.id, role: a.person.role } : { signedIn: false })
})

app.get('/api/state', async (c) => {
  const a = optionalActor(c)
  if (!a) return c.json({ error: 'Sign in required' }, 401)
  return c.json(await view(a.person.id, a))
})
app.get('/api/payday/preview', (c) => {
  requireFinance(actorFrom(c))
  const staff = S.people.filter((x) => x.salary)
  return c.json({ date: S.nextPayday, total: staff.reduce((s, x) => s + (x.salary ?? 0), 0), lines: staff.map((x) => ({ personId: x.id, name: x.name, title: x.title, gross: x.salary })) })
})

app.post('/api/setup', async (c) => {
  rateLimit(c, 'setup', 5)
  const existing = optionalActor(c)
  if (S.seeded) return c.json(await view(existing?.person.id, existing ?? actorFrom(c)))
  const body = await c.req.json().catch(() => ({}))
  const setup = z.object({
    companyName: z.string().trim().min(1).max(80).optional(),
    departments: z.array(z.object({ team: text(60), budget: number, perPersonCap: number, color: z.string().optional(), headName: text(80).optional(), headTitle: text(80).optional() })).optional(),
    invites: z.array(z.object({ name: text(80), role: z.enum(['employee', 'contractor']).default('employee'), title: text(80), team: text(40), salary: optionalNumber, country: z.string().optional() })).optional(),
  }).parse(body)
  if (setup.companyName) S.company.name = setup.companyName
  if (setup.departments?.length) {
    const defaultVendorIds = S.vendors.slice(0, 4).map((v) => v.id)
    S.pots = setup.departments.map((d, i): Pot => ({ id: slug(d.team), team: d.team, budget: roundMoney(d.budget), perPersonCap: roundMoney(d.perPersonCap), periodLabel: 'month', periodSec: MONTH, vendorIds: defaultVendorIds, color: d.color || colors[i % colors.length], rootMode: 'demo-server-p256' }))
    S.people = [S.people.find((p) => p.role === 'admin')!]
    for (const d of setup.departments) {
      if (!d.headName) continue
      const pt = pot(slug(d.team))
      S.people.push({ id: slug(d.headName), name: d.headName, role: 'lead', title: d.headTitle || `${pt.team} Lead`, team: pt.id, salary: undefined, address: T.newAddress(), demoKey: true })
    }
    S.perks = []
  }
  const setupInviteLinks: { personId: string; inviteLink: string }[] = []
  for (const inv of setup.invites ?? []) {
    const teamId = S.pots.find((p) => p.id === inv.team || p.team.toLowerCase() === inv.team.toLowerCase())?.id
    if (!teamId) continue
    const p: Person = { id: slug(inv.name), name: inv.name, role: inv.role, title: inv.title, team: teamId, salary: inv.salary, country: inv.country, address: T.newAddress(), demoKey: false }
    S.people.push(p)
    const raw = randomBytes(18).toString('base64url')
    S.invites.push({ token: hashSecret(raw), personId: p.id, createdBy: 'jordan', createdAt: now(), expiresAt: now() + DAY_MS })
    setupInviteLinks.push({ personId: p.id, inviteLink: `/app/invite/${raw}` })
  }
  for (const pt of S.pots) await fundDepartment(pt)
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
  const session = createSession('jordan', true)
  setSessionCookie(c, session.id, 2 * DAY_MS / 1000)
  return c.json({ ...(await view('jordan', { person: person('jordan'), session, demo: true })), inviteLinks: setupInviteLinks })
})

app.post('/api/settings/payday', async (c) => {
  requireFinance(actorFrom(c))
  const body = await parseBody(c, z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  S.nextPayday = body.date
  log({ kind: 'admin', title: 'Next payday set', detail: body.date, memo: 'admin:payday-date' })
  return c.json({ ok: true, date: S.nextPayday })
})

app.post('/api/settings/finance-rule', async (c) => {
  requireFinance(actorFrom(c))
  const body = await parseBody(c, z.object({ threshold: number }))
  S.company.financeApprovalThreshold = roundMoney(body.threshold)
  log({ kind: 'admin', title: 'Finance rule updated', detail: `Payments over $${S.company.financeApprovalThreshold} need Finance`, memo: 'admin:finance-rule' })
  return c.json({ ok: true, threshold: S.company.financeApprovalThreshold })
})

app.post('/api/invites', async (c) => {
  rateLimit(c, 'invite', 20)
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ name: text(80), role: z.enum(['lead', 'employee', 'contractor']), title: text(80), team: text(40), salary: optionalNumber, country: z.string().optional() }))
  pot(body.team)
  if (!canInviteFor(a, body.role, body.team)) throw forbidden('Only Finance or this department head can invite here')
  const p: Person = { id: slug(body.name), name: body.name, role: body.role, title: body.title, team: body.team, salary: body.salary, country: body.country, address: T.newAddress(), demoKey: false }
  S.people.push(p)
  const raw = randomBytes(18).toString('base64url')
  const inv: Invite = { token: hashSecret(raw), personId: p.id, createdBy: a.person.id, createdAt: now(), expiresAt: now() + DAY_MS }
  S.invites.push(inv)
  log({ kind: 'admin', title: `${p.name} invited`, detail: `${p.title} · ${pot(body.team).team}`, who: p.id, potId: body.team, memo: 'admin:invite' })
  return c.json({ ok: true, person: p, inviteLink: `/app/invite/${raw}`, token: raw, expiresAt: inv.expiresAt })
})

app.get('/api/invites/:token', (c) => {
  const inv = requireOne(S.invites.find((x) => x.token === hashSecret(c.req.param('token')) && !x.usedAt && x.expiresAt > now()), 'Invite')
  const p = person(inv.personId)
  return c.json({ person: { id: p.id, name: p.name, title: p.title, role: p.role, team: p.team ? pot(p.team).team : undefined }, expiresAt: inv.expiresAt })
})

app.post('/api/invites/:token/accept', async (c) => {
  rateLimit(c, 'invite-accept', 10)
  const inv = requireOne(S.invites.find((x) => x.token === hashSecret(c.req.param('token')) && !x.usedAt && x.expiresAt > now()), 'Invite')
  const body = await parseBody(c, z.object({ id: text(200), publicKey: z.string().regex(/^0x[0-9a-fA-F]+$/) }))
  const x = person(inv.personId)
  const pt = pot(x.team!)
  const tx = await T.issueKeyOn(deptRoot(pt.id), { passkey: body.publicKey as `0x${string}` }, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  x.passkey = { id: body.id, publicKey: body.publicKey as `0x${string}`, tx }
  x.demoKey = false
  inv.usedAt = now()
  log({ kind: 'setup', title: `${x.name.split(' ')[0]} set up Face ID`, detail: `Joined ${pt.team}`, tx, who: x.id, potId: pt.id, memo: 'setup:invite' })
  const session = createSession(x.id, false)
  setSessionCookie(c, session.id)
  return c.json({ ok: true, personId: x.id })
})

app.post('/api/payday', async (c) => {
  requireFinance(actorFrom(c))
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
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ personId: text(40), vendorId: text(60), amount: number, note: z.string().trim().max(60).optional().default(''), source: z.enum(['pot', 'perk']).optional().default('pot'), perkId: z.string().optional(), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const x = person(body.personId)
  requireSelf(a, x.id)
  const v = vendor(body.vendorId)
  const amount = roundMoney(body.amount)
  if (body.source === 'perk') {
    const p = perk(body.perkId ?? '')
    if (p.personId !== x.id) return c.json({ error: 'That perk belongs to someone else' }, 400)
    if (!p.vendorIds.includes(v.id)) return c.json({ error: `${v.name} is not on this perk yet` }, 400)
    const tx = await T.spendWithKeyOn(deptRoot(x.team!), { pk: perkKeyPk(p.id) }, v.address, amount, moneyMemo(`perk:${p.name}`))
    log({ kind: 'spend', title: `${x.name.split(' ')[0]} used ${p.name}`, detail: `${v.name} · ${body.note || v.category}`, amount, tx, who: x.id, perkId: p.id, memo: `perk:${p.name}` })
    const out = { ok: true, tx, receipt: T.EXPLORER + tx }
    if (body.requestId) S.processed[body.requestId] = out
    return c.json(out)
  }
  const pt = pot(x.team!)
  if (amount > S.company.financeApprovalThreshold) {
    const out = { ok: false, held: hold(x, v, pt, amount, body.note, 'finance-rule'), reason: `Payments over $${S.company.financeApprovalThreshold} need Finance` }
    if (body.requestId) S.processed[body.requestId] = out
    return c.json(out)
  }
  try {
    const tx = await T.spendWithKeyOn(deptRoot(pt.id), { pk: keyPk(x) }, v.address, amount, moneyMemo(`${pt.id}:${body.note || v.category}`))
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

function hold(x: Person, v: Vendor, pt: Pot, amount: number, note: string, forcedReason?: Held['reason']) {
  const reason = forcedReason ?? holdReason(pt, v.id)
  const h: Held = { id: uid(), at: Date.now(), personId: x.id, potId: pt.id, vendorId: v.id, amount, note: note || v.category, reason, status: 'held' }
  S.held.unshift(h)
  log({ kind: 'held', title: `Held for approval: ${v.name}`, detail: reason === 'new-vendor' ? `${v.name} needs a lead's OK` : reason === 'finance-rule' ? `Payments over $${S.company.financeApprovalThreshold} need Finance` : `Over ${x.name.split(' ')[0]}'s monthly limit`, amount, who: x.id, potId: pt.id, memo: `${pt.id}:held` })
  return h
}

app.post('/api/passkey/enroll', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ personId: text(40), id: text(200), publicKey: z.string().regex(/^0x[0-9a-fA-F]+$/) }))
  const x = person(body.personId)
  requireSelf(a, x.id)
  const pt = pot(x.team!)
  const tx = await T.issueKeyOn(deptRoot(pt.id), { passkey: body.publicKey as `0x${string}` }, pt.perPersonCap, pt.periodSec, pt.vendorIds.map((v) => vendor(v).address))
  if (x.demoKey && !x.passkey) await T.revokeKeyOn(deptRoot(pt.id), { pk: keyPk(x) }).catch(() => {})
  x.passkey = { id: body.id, publicKey: body.publicKey as `0x${string}`, tx }
  x.demoKey = false
  log({ kind: 'setup', title: `${x.name.split(' ')[0]} turned on Face ID`, detail: `Pays from the ${pt.team} pot with this device`, tx, who: x.id, potId: pt.id, memo: `setup:face` })
  return c.json({ ok: true })
})

app.get('/api/passkey/pay-info/:personId', (c) => {
  const a = actorFrom(c)
  const x = person(c.req.param('personId'))
  requireSelf(a, x.id)
  return c.json({ company: deptAddress(x.team!), token: T.TOKEN, credentialId: x.passkey?.id, publicKey: x.passkey?.publicKey, vendors: Object.fromEntries(S.vendors.map((v) => [v.id, v.address])), potId: x.team })
})

app.post('/api/passkey/record', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ personId: text(40), vendorId: text(60), amount: number, note: z.string().trim().max(60).optional().default(''), tx: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(), rejected: z.boolean().optional(), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const x = person(body.personId), v = vendor(body.vendorId), pt = pot(x.team!)
  requireSelf(a, x.id)
  if (roundMoney(body.amount) > S.company.financeApprovalThreshold) return c.json({ ok: false, held: hold(x, v, pt, roundMoney(body.amount), body.note, 'finance-rule') })
  if (body.rejected) return c.json({ ok: false, held: hold(x, v, pt, roundMoney(body.amount), body.note) })
  if (!body.tx) return c.json({ error: 'Missing receipt' }, 400)
  if (S.activity.some((a) => a.tx === body.tx)) return c.json({ error: 'Payment already recorded' }, 409)
  if (!(await T.verifySpend(body.tx as `0x${string}`, v.address, roundMoney(body.amount), deptAddress(pt.id)))) return c.json({ error: 'Payment could not be confirmed' }, 400)
  log({ kind: 'spend', title: `${x.name.split(' ')[0]} paid ${v.name}`, detail: `${pt.team} pot · ${body.note || v.category} · Face ID`, amount: roundMoney(body.amount), tx: body.tx, who: x.id, potId: pt.id, memo: `${pt.id}:${body.note || v.category}` })
  const out = { ok: true, tx: body.tx, receipt: T.EXPLORER + body.tx }
  if (body.requestId) S.processed[body.requestId] = out
  return c.json(out)
})

app.post('/api/held/:id/:action', async (c) => {
  const a = actorFrom(c)
  const h = requireOne(S.held.find((x) => x.id === c.req.param('id')), 'Held payment')
  const action = c.req.param('action')
  if (!['approve', 'approve-add', 'return'].includes(action)) return c.json({ error: 'Unknown decision' }, 400)
  const body = await parseBody(c, z.object({ requestId, approverId: z.string().optional() }).optional().default({}))
  const idem = body.requestId
  if (idem && S.processed[idem]) return c.json(S.processed[idem])
  if (h.status !== 'held') return c.json(h)
  // Finance can decide anything; a lead can decide their own team's requests, but never their own.
  const approver = a.person
  const canDecide = approver.role === 'admin' || (h.reason !== 'finance-rule' && approver.role === 'lead' && approver.team === h.potId && approver.id !== h.personId)
  if (!canDecide) return c.json({ error: approver.id === h.personId ? "You can't approve your own request. Finance will take it from here." : "Only Finance or this team's lead can decide this." }, 403)
  if (action === 'approve' || action === 'approve-add') {
    const v = vendor(h.vendorId)
    h.tx = await T.payFrom(deptRoot(h.potId), v.address, h.amount, moneyMemo(`${h.potId}:approved`))
    h.status = 'approved'
    if (action === 'approve-add') {
      const pt = pot(h.potId)
      if (!pt.vendorIds.includes(v.id)) pt.vendorIds.push(v.id)
      const receipts = await reissueTeamKeys(pt.id)
      log({ kind: 'admin', title: `${v.name} added to ${pt.team}`, detail: `Updated ${receipts.length} team cards`, tx: receipts[0], potId: pt.id, memo: `${pt.id}:vendor` })
    }
    log({ kind: 'approved', title: `Approved: ${v.name}`, detail: `Paid by ${pot(h.potId).team}`, amount: h.amount, tx: h.tx, who: h.personId, potId: h.potId, memo: `${h.potId}:approved` })
  } else {
    h.status = 'returned'
    log({ kind: 'returned', title: `Returned: ${vendor(h.vendorId).name}`, detail: 'Nothing was paid', amount: h.amount, who: h.personId, potId: h.potId, memo: `${h.potId}:returned` })
  }
  if (idem) S.processed[idem] = h
  return c.json(h)
})

app.post('/api/vendors', async (c) => {
  requireFinance(actorFrom(c))
  const body = await parseBody(c, z.object({ name: text(80), category: text(40) }))
  if (S.vendors.some((v) => v.name.toLowerCase() === body.name.toLowerCase())) return c.json({ error: 'That vendor is already here' }, 409)
  const v: Vendor = { id: slug(body.name), name: body.name, category: body.category, address: T.newAddress() }
  S.vendors.push(v)
  log({ kind: 'admin', title: `${v.name} added`, detail: v.category, memo: 'admin:vendor' })
  return c.json(v)
})

app.post('/api/people', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ name: text(80), role: z.enum(['admin', 'lead', 'employee', 'contractor']), title: text(80), team: z.string().optional(), salary: optionalNumber, country: z.string().optional() }))
  if (!canInviteFor(a, body.role, body.team)) throw forbidden('Only Finance or the department head can add this person')
  if (body.team) pot(body.team)
  const p: Person = { id: slug(body.name), name: body.name, role: body.role, title: body.title, team: body.team, salary: body.salary, country: body.country, address: T.newAddress(), demoKey: body.role === 'lead' || body.role === 'employee' }
  S.people.push(p)
  if (S.seeded && p.demoKey) await issuePotKey(p)
  log({ kind: 'admin', title: `${p.name} joined`, detail: p.title, who: p.id, memo: 'admin:person' })
  return c.json(p)
})

app.post('/api/people/:id/update', async (c) => {
  const a = actorFrom(c)
  const p = person(c.req.param('id'))
  requireFinanceOrHead(a, p.team)
  const body = await parseBody(c, z.object({ name: text(80).optional(), role: z.enum(['admin', 'lead', 'employee', 'contractor']).optional(), title: text(80).optional(), team: z.string().optional(), salary: optionalNumber, country: z.string().optional() }))
  if (body.role === 'admin' && !isFinance(a)) throw forbidden('Only Finance can create Finance users')
  const keyAffects = body.team !== undefined && body.team !== p.team
  if (body.team) pot(body.team)
  Object.assign(p, body)
  if (keyAffects && S.seeded && p.demoKey) await issuePotKey(p)
  log({ kind: 'admin', title: `${p.name} updated`, detail: keyAffects ? `Updating ${p.name.split(' ')[0]}'s card` : 'Profile saved', who: p.id, memo: 'admin:person' })
  return c.json(p)
})

app.post('/api/people/:id/remove', async (c) => {
  const a = actorFrom(c)
  const p = person(c.req.param('id'))
  requireFinanceOrHead(a, p.team)
  if (p.role === 'admin') throw forbidden('Finance users cannot be removed here')
  if (p.keyTx && p.team) await T.revokeKeyOn(deptRoot(p.team), p.passkey && !p.passkey.needsRefresh ? { passkey: p.passkey.publicKey } : { pk: keyPk(p) }).catch(() => {})
  p.removed = true
  S.sessions = S.sessions.filter((s) => s.personId !== p.id)
  log({ kind: 'admin', title: `${p.name} removed`, detail: p.team ? `${pot(p.team).team} access revoked` : 'Access revoked', who: p.id, potId: p.team, memo: 'admin:remove' })
  return c.json({ ok: true, personId: p.id })
})

app.post('/api/pots', async (c) => {
  requireFinance(actorFrom(c))
  const body = await parseBody(c, z.object({ team: text(60), perPersonCap: number, budget: optionalNumber, vendorIds: z.array(z.string()).min(1), color: z.string().optional() }))
  body.vendorIds.forEach((id) => vendor(id))
  const pt: Pot = { id: slug(body.team), team: body.team, perPersonCap: roundMoney(body.perPersonCap), budget: roundMoney(body.budget ?? body.perPersonCap * 3), periodLabel: 'month', periodSec: MONTH, vendorIds: body.vendorIds, color: body.color || colors[S.pots.length % colors.length], rootMode: 'demo-server-p256' }
  S.pots.push(pt)
  if (S.seeded) await fundDepartment(pt)
  log({ kind: 'admin', title: `${pt.team} pot created`, detail: `$${pt.perPersonCap}/month`, potId: pt.id, memo: 'admin:pot' })
  return c.json(pt)
})

app.post('/api/pots/:id/update', async (c) => {
  const a = actorFrom(c)
  const pt = pot(c.req.param('id'))
  requireFinanceOrHead(a, pt.id)
  const body = await parseBody(c, z.object({ team: text(60).optional(), perPersonCap: number.optional(), budget: optionalNumber, vendorIds: z.array(z.string()).optional(), color: z.string().optional() }))
  if (body.vendorIds) body.vendorIds.forEach((id) => vendor(id))
  const keyAffects = body.perPersonCap !== undefined || body.vendorIds !== undefined
  Object.assign(pt, { ...body, perPersonCap: body.perPersonCap ? roundMoney(body.perPersonCap) : pt.perPersonCap, budget: body.budget !== undefined ? roundMoney(body.budget) : pt.budget })
  const receipts = keyAffects && S.seeded ? await reissueTeamKeys(pt.id) : []
  log({ kind: 'admin', title: `${pt.team} pot updated`, detail: keyAffects ? `Updated ${receipts.length} team cards` : 'Saved', tx: receipts[0], potId: pt.id, memo: 'admin:pot' })
  return c.json({ ...pt, reissued: receipts.length })
})

app.post('/api/pots/:id/fund', async (c) => {
  requireFinance(actorFrom(c))
  const pt = pot(c.req.param('id'))
  const body = await parseBody(c, z.object({ amount: number, requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const tx = await fundDepartment(pt, roundMoney(body.amount))
  const out = { ok: true, tx, potId: pt.id, receipt: tx ? T.EXPLORER + tx : undefined }
  if (body.requestId) S.processed[body.requestId] = out
  return c.json(out)
})

app.post('/api/pots/:id/topup-request', async (c) => {
  const a = actorFrom(c)
  const pt = pot(c.req.param('id'))
  requireFinanceOrHead(a, pt.id)
  const body = await parseBody(c, z.object({ amount: number, note: z.string().trim().max(80).optional().default('Budget top-up') }))
  const finance = S.people.find((p) => p.role === 'admin')!
  const syntheticVendor = S.vendors.find((v) => v.id === 'notion') ?? S.vendors[0]
  const h: Held = { id: uid(), at: now(), personId: finance.id, potId: pt.id, vendorId: syntheticVendor.id, amount: roundMoney(body.amount), note: body.note, reason: 'finance-rule', status: 'held' }
  S.held.unshift(h)
  log({ kind: 'held', title: `${pt.team} requested top-up`, detail: body.note, amount: h.amount, who: a.person.id, potId: pt.id, memo: `${pt.id}:topup` })
  return c.json(h)
})

app.post('/api/pots/:id/return', async (c) => {
  const a = actorFrom(c)
  const pt = pot(c.req.param('id'))
  requireFinanceOrHead(a, pt.id)
  const body = await parseBody(c, z.object({ amount: number, requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const amount = roundMoney(body.amount)
  const tx = await T.payFrom(deptRoot(pt.id), S.company.address, amount, moneyMemo(`return ${pt.team}`))
  pt.returnTx = tx
  log({ kind: 'admin', title: `${pt.team} returned budget`, detail: `${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} returned to Finance`, amount, tx, potId: pt.id, memo: `${pt.id}:return` })
  const out = { ok: true, tx, potId: pt.id, receipt: T.EXPLORER + tx }
  if (body.requestId) S.processed[body.requestId] = out
  return c.json(out)
})

app.post('/api/perks', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ personId: text(40), name: text(60), cap: number, periodLabel: z.enum(['day', 'month', 'year']), vendorIds: z.array(z.string()).min(1), color: z.string().optional() }))
  const p = person(body.personId)
  requireFinanceOrHead(a, p.team)
  body.vendorIds.forEach((id) => vendor(id))
  const periodSec = body.periodLabel === 'day' ? DAY : body.periodLabel === 'year' ? YEAR : MONTH
  const perk: Perk = { id: slug(`${p.id}-${body.name}`), personId: p.id, name: body.name, cap: roundMoney(body.cap), periodLabel: body.periodLabel, periodSec, vendorIds: body.vendorIds, color: body.color || '#E8552D' }
  S.perks.push(perk)
  if (S.seeded) await issuePerkKey(perk)
  log({ kind: 'perk', title: `${p.name.split(' ')[0]} got ${perk.name}`, detail: `$${perk.cap}/${perk.periodLabel}`, who: p.id, perkId: perk.id, tx: perk.keyTx, memo: `perk:${perk.name}` })
  return c.json(perk)
})

app.post('/api/pots/:id/close', async (c) => {
  const a = actorFrom(c)
  const pt = pot(c.req.param('id'))
  requireFinanceOrHead(a, pt.id)
  const body = await parseBody(c, z.object({ sharePct: z.coerce.number().min(0).max(100).default(20), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const members = S.people.filter((p) => p.team === pt.id)
  const limits = await Promise.all(members.map((m) => cachedRemaining(`pot:${m.id}:${m.team}:${m.keyTx ?? ''}`, keyRef(m), deptRoot(pt.id))))
  const savings = potSavings(limits.map((l) => l?.remaining ?? 0), potApprovedTotal(S, pt.id))
  const split = splitKudos(savings, body.sharePct, members.map((m) => m.id))
  if (split.pool <= 0) return c.json({ error: 'No savings to share this time' }, 400)
  const r = await T.paydayFrom(deptRoot(pt.id), split.lines.map((l) => ({ to: person(l.personId).address, amount: l.amount, note: `kudos ${pt.team}` })))
  const close = { id: uid(), at: Date.now(), potId: pt.id, savings, sharePct: body.sharePct, pool: split.pool, perPerson: split.perPerson, tx: r.tx, memberIds: members.map((m) => m.id) }
  S.quarterCloses.unshift(close)
  for (const line of split.lines) S.kudosCredits.push({ personId: line.personId, closeId: close.id, left: line.amount })
  log({ kind: 'quarter', title: `${pt.team} saved $${roundMoney(savings).toLocaleString('en-US')}`, detail: `${body.sharePct}% became a kudos pool`, amount: split.pool, tx: r.tx, potId: pt.id, memo: `kudos:${pt.id}` })
  if (body.requestId) S.processed[body.requestId] = close
  return c.json(close)
})

app.post('/api/kudos', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ fromPersonId: text(40), toPersonId: text(40), amount: number, note: text(80), requestId }))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  const from = person(body.fromPersonId), to = person(body.toPersonId)
  requireSelf(a, from.id)
  if (from.id === to.id) return c.json({ error: 'Pick a teammate' }, 400)
  const check = canAwardKudos(S.kudosCredits, from.id, roundMoney(body.amount))
  if (!check.ok) return c.json({ error: `Only $${check.left.toFixed(2)} left to award` }, 400)
  const tx = await T.payFrom(deptRoot(from.team!), to.address, roundMoney(body.amount), moneyMemo(`kudos:${body.note}`))
  applyKudosDebit(S.kudosCredits, from.id, roundMoney(body.amount))
  const award = { id: uid(), at: Date.now(), fromPersonId: from.id, toPersonId: to.id, amount: roundMoney(body.amount), note: body.note, tx }
  S.kudosAwards.unshift(award)
  log({ kind: 'kudos', title: `${from.name.split(' ')[0]} sent kudos to ${to.name.split(' ')[0]}`, detail: body.note, amount: award.amount, tx, who: to.id, potId: to.team, memo: `kudos:${body.note}` })
  if (body.requestId) S.processed[body.requestId] = award
  return c.json(award)
})

app.post('/api/invoices', async (c) => {
  const a = actorFrom(c)
  const body = await parseBody(c, z.object({ contractorId: text(40), amount: number, description: text(120), requestId }))
  const contractor = person(body.contractorId)
  requireSelf(a, contractor.id)
  if (contractor.role !== 'contractor') return c.json({ error: 'Invoices are for contractors' }, 400)
  const inv: Invoice = { id: uid(), number: invoiceNumber(S.invoices), at: Date.now(), contractorId: contractor.id, amount: roundMoney(body.amount), description: body.description, status: 'submitted' }
  S.invoices.unshift(inv)
  log({ kind: 'invoice', title: `${contractor.name} sent ${inv.number}`, detail: body.description, amount: inv.amount, who: contractor.id, memo: `invoice:${inv.number}` })
  return c.json(inv)
})

app.post('/api/invoices/:id/pay', async (c) => {
  const a = actorFrom(c)
  const inv = requireOne(S.invoices.find((x) => x.id === c.req.param('id')), 'Invoice')
  const contractor = person(inv.contractorId)
  requireFinanceOrHead(a, contractor.team)
  const body = await parseBody(c, z.object({ requestId }).optional().default({}))
  if (body.requestId && S.processed[body.requestId]) return c.json(S.processed[body.requestId])
  if (inv.status === 'paid') return c.json(inv)
  if (inv.status === 'declined') return c.json({ error: 'This invoice was declined' }, 409)
  const t0 = Date.now()
  inv.tx = contractor.team ? await T.payFrom(deptRoot(contractor.team), contractor.address, inv.amount, inv.number) : await T.companyPay(contractor.address, inv.amount, inv.number)
  inv.paidMs = Date.now() - t0
  inv.status = 'paid'
  log({ kind: 'paid', title: `${contractor.name} paid · ${inv.number}`, detail: `Paid in ${(inv.paidMs / 1000).toFixed(1)}s`, amount: inv.amount, tx: inv.tx, who: inv.contractorId, potId: contractor.team, memo: `invoice:${inv.number}` })
  if (body.requestId) S.processed[body.requestId] = inv
  return c.json(inv)
})

app.post('/api/invoices/:id/decline', async (c) => {
  const a = actorFrom(c)
  const inv = requireOne(S.invoices.find((x) => x.id === c.req.param('id')), 'Invoice')
  requireFinanceOrHead(a, person(inv.contractorId).team)
  const body = await parseBody(c, z.object({ reason: text(120), requestId }))
  if (inv.status !== 'submitted') return c.json(inv)
  inv.status = 'declined'
  inv.declineReason = body.reason
  log({ kind: 'declined', title: `${inv.number} declined`, detail: body.reason, amount: inv.amount, who: inv.contractorId, memo: `invoice:${inv.number}` })
  return c.json(inv)
})

app.get('/api/receipts/:id', (c) => {
  const scope = scopeFor(actorFrom(c))
  const a = requireOne(S.activity.find((x) => x.id === c.req.param('id')) ?? scopedActivity(scope).find((x) => x.id === c.req.param('id')), 'Receipt')
  if (!canSeeActivity(scope, a)) return c.json({ error: 'Receipt not found' }, 404)
  const who = a.who ? S.people.find((p) => p.id === a.who) : undefined
  const pt = a.potId ? S.pots.find((p) => p.id === a.potId) : undefined
  return c.json({ ...a, whoName: who?.name, potName: pt?.team, memoLabel: decodeMemoLabel(a.memo), publicRecord: a.tx ? T.EXPLORER + a.tx : undefined })
})

app.get('/api/activity.csv', (c) => {
  const scope = scopeFor(actorFrom(c))
  const rows = [['date', 'kind', 'title', 'detail', 'amount', 'person', 'pot', 'receipt']]
  for (const a of scopedActivity(scope)) rows.push([new Date(a.at).toISOString(), a.kind, a.title, a.detail, a.amount?.toString() ?? '', a.who ? person(a.who).name : '', a.potId ? pot(a.potId).team : '', a.tx ? T.EXPLORER + a.tx : ''])
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  return c.text(rows.map((r) => r.map(esc).join(',')).join('\n'), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="teampot-activity.csv"' })
})

app.post('/api/reset', (c) => {
  rateLimit(c, 'reset', 5)
  const need = process.env.RESET_TOKEN
  if (need && c.req.header('x-reset-token') !== need) return c.json({ error: 'Not allowed' }, 403)
  S = seedState()
  invalidateCache()
  return c.json({ ok: true })
})
