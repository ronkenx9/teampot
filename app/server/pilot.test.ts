import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { createHash, randomUUID } from 'node:crypto'
import { emptyDirectory, type Directory, type DirectoryStore, type Membership, type Role } from './workspace-store.js'
import { assertMembershipChangeSafe, pilotPaymentsReady, registerPilotRoutes } from './pilot.js'
import type { PilotAdapter, PilotChainResult, PilotCommand, PilotLedger, PreparedPilotTransaction } from './pilot-types.js'

const token = '0x20c0000000000000000000000000000000000000'
const hash = (value: string) => `0x${createHash('sha256').update(value).digest('hex')}`
const address = (value: string) => hash(value).slice(0, 42)
type TestDirectory = Directory & { pilot?: PilotLedger }
let state: TestDirectory, app: Hono, ids: Record<string, string>, store: DirectoryStore
let adapter: PilotAdapter, prepared: PilotCommand[], submitted: string[], receipts: Map<string, PilotChainResult>
let prepareError: any, submitError: any, pending: boolean, pausePrepare: Promise<void> | undefined
function auth(s: Directory, c: any, workspaceId?: string) {
  const who = c.req.header('x-test-user'), membership = c.req.header('x-test-membership') || ids[who]
  const user = s.users.find(u => u.id === who), m = s.memberships.find(m => m.id === membership && m.userId === who && m.active)
  if (!user) throw Object.assign(new Error('Sign in.'), { status: 401 })
  if (!m || workspaceId && m.workspaceId !== workspaceId) throw Object.assign(new Error('No company access.'), { status: 403 })
  return { user, m, session: { hash: 'test', userId: who, membershipId: m.id, expiresAt: Date.now() + 100000 } }
}
const req = (who: string, body?: unknown, membership?: string) => app.request('http://localhost' + (body === undefined ? '/pilot' : '/pilot/actions'), { method: body === undefined ? 'GET' : 'POST', headers: { 'x-test-user': who, 'content-type': 'application/json', ...(membership ? { 'x-test-membership': membership } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
const action = async (who: string, action: string, extra: Record<string, unknown> = {}, requestId = randomUUID()) => {
  const r = await req(who, { workspaceId: state.memberships.find(m => m.id === ids[who])!.workspaceId, requestId, action, ...extra })
  return { status: r.status, body: await r.json() as any, requestId }
}
const mem = (who: string) => state.memberships.find(m => m.id === ids[who])!
const wa = () => state.pilot!.workspaces[ids.a]
const vendor = (workspaceId = ids.a, n = 0) => adapter.vendors(workspaceId)[n]
async function setup(company = 'a') {
  const owner = `owner${company}`, lead = `lead${company}`, employee = `employee${company}`, departmentId = ids[`dept${company}`]
  expect((await action(owner, 'provision')).body.status).toBe('confirmed')
  expect((await action(owner, 'fund', { departmentId, amount: 1000 })).body.status).toBe('confirmed')
  expect((await action(owner, 'delegate', { departmentId, membershipId: ids[lead] })).body.status).toBe('confirmed')
  const card = await action(lead, 'issue', { departmentId, membershipId: ids[employee], cap: 100, allowedVendorIds: [vendor(ids[company]).id] })
  expect(card.body.status).toBe('confirmed')
  return card.requestId
}
async function held(cardId: string, who = 'employeea', amount = 25) {
  prepareError = Object.assign(new Error('CallNotAllowed'), { code: 'POLICY_REJECTED' })
  const result = await action(who, 'spend', { cardId, vendorId: vendor().id, amount, note: 'Design tools' })
  prepareError = undefined
  expect(result.body.status).toBe('held')
  return result.requestId
}
beforeEach(() => {
  state = emptyDirectory(); ids = {}; prepared = []; submitted = []; receipts = new Map(); prepareError = undefined; submitError = undefined; pending = false; pausePrepare = undefined
  for (const company of ['a', 'b']) {
    ids[company] = randomUUID(); ids[`dept${company}`] = randomUUID(); ids[`other${company}`] = randomUUID()
    state.workspaces.push({ id: ids[company], name: `Company ${company}`, createdAt: 0, createdBy: `owner${company}` })
    state.departments.push({ id: ids[`dept${company}`], workspaceId: ids[company], name: 'Design' }, { id: ids[`other${company}`], workspaceId: ids[company], name: 'Operations' })
    for (const role of ['owner', 'finance', 'lead', 'employee', 'contractor', 'otherlead', 'otheremployee']) {
      const who = role + company, assignedRole = role.replace('other', '') as Role
      ids[who] = randomUUID(); state.users.push({ id: who, name: who, createdAt: 0, credentials: [] })
      state.memberships.push({ id: ids[who], userId: who, workspaceId: ids[company], role: assignedRole, title: assignedRole, active: true, departmentId: ['owner', 'finance'].includes(role) ? undefined : ids[role.startsWith('other') ? `other${company}` : `dept${company}`] })
    }
  }
  let queue: Promise<unknown> = Promise.resolve()
  store = { read: async () => structuredClone(state), change: fn => {
    const run = queue.then(async () => { const copy = structuredClone(state); const result = await fn(copy); state = copy; return result })
    queue = run.catch(() => {}); return run
  } }
  adapter = {
    network: 'testnet', chainId: 42431, token,
    addresses: (w, d, m, c) => ({ treasury: address(`treasury:${w}`), department: d ? address(`dept:${w}:${d}`) : undefined, headKey: m ? address(`head:${w}:${d}:${m}`) : undefined, cardKey: c ? address(`card:${w}:${d}:${m}:${c}`) : undefined }),
    vendors: w => [{ id: `vendor-one-${w}`, name: 'Design tools', address: address(`vendor1:${w}`) }, { id: `vendor-two-${w}`, name: 'Travel', address: address(`vendor2:${w}`) }],
    balances: async addresses => Object.fromEntries(addresses.map(a => [a, 1000])),
    prepare: async command => { prepared.push(command); await pausePrepare; if (prepareError) throw prepareError; return { raw: '0x' + Buffer.from(JSON.stringify(command)).toString('hex'), hash: hash(command.workspaceId + command.operationId) } },
    submit: async tx => { submitted.push(tx.raw); if (submitError) throw submitError; const result = { status: pending ? 'pending' as const : 'confirmed' as const, tx: tx.hash }; if (!pending) receipts.set(tx.hash, result); return result },
    status: async tx => receipts.get(tx.hash) || { status: 'pending', tx: tx.hash },
  }
  app = new Hono(); app.onError((e: any, c) => c.json({ error: e.message }, e.status || 500)); registerPilotRoutes(app, store, adapter, auth)
})

describe('company pilot success and scopes', () => {
  it('completes isolated funding, delegation, spending, receipts and revocation for two companies', async () => {
    const ca = await setup('a'), cb = await setup('b')
    const pa = await action('employeea', 'spend', { cardId: ca, vendorId: vendor(ids.a).id, amount: 20, note: 'Tools' })
    const pb = await action('employeeb', 'spend', { cardId: cb, vendorId: vendor(ids.b).id, amount: 30, note: 'Supplies' })
    expect(pa.body.status).toBe('confirmed'); expect(pb.body.status).toBe('confirmed'); expect(pa.body.tx).not.toBe(pb.body.tx)
    const a = await (await req('ownera')).json() as any, b = await (await req('ownerb')).json() as any
    expect(a.treasury.address).not.toBe(b.treasury.address); expect(a.cards.map((c: any) => c.id)).toEqual([ca]); expect(b.cards.map((c: any) => c.id)).toEqual([cb]); expect(a.receipts.some((r: any) => r.tx === pa.body.tx)).toBe(true)
    expect(pilotPaymentsReady(state, ids.a)).toBe(true)
    expect((await action('leada', 'revoke', { cardId: ca })).body.status).toBe('confirmed')
    expect((await action('employeea', 'spend', { cardId: ca, vendorId: vendor().id, amount: 1, note: 'No' })).status).toBe(403)
    expect((await action('employeeb', 'spend', { cardId: cb, vendorId: vendor(ids.b).id, amount: 1, note: 'Yes' })).body.status).toBe('confirmed')
  })
  it('exposes own employee records, department lead records and Finance company records without signed bytes', async () => {
    const card = await setup(); const h = await held(card)
    const employee = await (await req('employeea')).json() as any, other = await (await req('otheremployeea')).json() as any, lead = await (await req('leada')).json() as any, finance = await (await req('financea')).json() as any
    expect(employee.treasury).toBeNull(); expect(employee.departments).toHaveLength(1); expect(employee.requests[0].id).toBe(h)
    expect(other.cards).toEqual([]); expect(other.requests).toEqual([]); expect(other.receipts).toEqual([])
    expect(lead.cards).toHaveLength(1); expect(finance.treasury).not.toBeNull(); expect(finance.departments).toHaveLength(2)
    expect(JSON.stringify(finance)).not.toContain('raw'); expect(JSON.stringify(finance)).not.toContain('fingerprint')
  })
  it('uses delegated head signatures for card issuance and lead approval, and root signatures for Finance approval', async () => {
    const card = await setup(); let h = await held(card)
    expect(prepared.find(c => c.action === 'issue')!.headMembershipId).toBe(ids.leada)
    expect((await action('leada', 'approve', { heldId: h })).body.status).toBe('confirmed')
    expect(prepared.at(-1)!.headMembershipId).toBe(ids.leada)
    h = await held(card, 'employeea', 1500)
    expect((await action('leada', 'approve', { heldId: h })).status).toBe(403)
    expect((await action('financea', 'approve', { heldId: h })).body.status).toBe('confirmed')
    expect(prepared.at(-1)!.headMembershipId).toBeUndefined()
  })
  it('declines held requests without submitting a transaction', async () => {
    const card = await setup(), h = await held(card), count = submitted.length
    expect((await action('leada', 'decline', { heldId: h })).body.status).toBe('confirmed'); expect(submitted).toHaveLength(count)
    expect(wa().requests[0].status).toBe('declined'); expect((await action('financea', 'approve', { heldId: h })).status).toBe(409)
  })
})

describe('authorization boundaries and validation', () => {
  it('rejects unauthenticated, cross-company funding, cards, vendors and held requests', async () => {
    expect((await req('forged')).status).toBe(401)
    const card = await setup(), h = await held(card)
    expect((await req('ownerb', { workspaceId: ids.a, requestId: randomUUID(), action: 'fund', departmentId: ids.depta, amount: 1 })).status).toBe(403)
    expect((await action('ownera', 'fund', { departmentId: ids.deptb, amount: 1 })).status).toBe(404)
    await setup('b')
    expect((await action('employeeb', 'spend', { cardId: card, vendorId: vendor().id, amount: 1, note: 'No' })).status).toBe(404)
    expect((await action('employeea', 'spend', { cardId: card, vendorId: vendor(ids.b).id, amount: 1, note: 'No' })).status).toBe(404)
    expect((await action('ownerb', 'approve', { heldId: h })).status).toBe(404)
  })
  it('enforces provision, funding, delegation and issue role boundaries', async () => {
    expect((await action('employeea', 'provision')).status).toBe(403)
    expect((await action('ownera', 'fund', { departmentId: ids.depta, amount: 1 })).status).toBe(409)
    await setup()
    expect((await action('employeea', 'fund', { departmentId: ids.depta, amount: 1 })).status).toBe(403)
    expect((await action('leada', 'delegate', { departmentId: ids.othera, membershipId: ids.otherleada })).status).toBe(403)
    expect((await action('ownera', 'delegate', { departmentId: ids.othera, membershipId: ids.otheremployeea })).status).toBe(400)
    for (const who of ['financea', 'employeea', 'otherleada']) expect((await action(who, 'issue', { departmentId: ids.depta, membershipId: ids.contractora, cap: 10, allowedVendorIds: [vendor().id] })).status).toBe(403)
  })
  it('requires active matching card owner and current membership on each request', async () => {
    const card = await setup()
    expect((await action('contractora', 'spend', { cardId: card, vendorId: vendor().id, amount: 1, note: 'No' })).status).toBe(403)
    mem('employeea').active = false
    expect((await req('employeea')).status).toBe(403); expect((await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 1, note: 'No' })).status).toBe(403)
  })
  it('does not trust an old lead role after reassignment or undelegated lead access', async () => {
    const card = await setup(), h = await held(card)
    expect((await action('otherleada', 'approve', { heldId: h })).status).toBe(403)
    mem('leada').role = 'employee'
    expect((await action('leada', 'approve', { heldId: h })).status).toBe(403)
    expect((await action('financea', 'approve', { heldId: h })).body.status).toBe('confirmed')
  })
  it('rejects self-approval even when a person switches to a separate Finance membership', async () => {
    const card = await setup(), h = await held(card)
    const finance: Membership = { ...mem('financea'), id: randomUUID(), userId: 'employeea' }; state.memberships.push(finance)
    const r = await req('employeea', { workspaceId: ids.a, requestId: randomUUID(), action: 'approve', heldId: h }, finance.id)
    expect(r.status).toBe(403); expect((await r.json()).error).toMatch(/own payment/)
  })
  it.each([0, -1, 10001, 0.001, '10'])('rejects invalid amount %s', async value => {
    expect((await action('ownera', 'fund', { departmentId: ids.depta, amount: value })).status).toBe(400)
  })
  it('rejects empty/duplicate/foreign allowlists and duplicate active cards', async () => {
    await setup()
    for (const allowedVendorIds of [[], [vendor().id, vendor().id], [vendor(ids.b).id]]) expect((await action('leada', 'issue', { departmentId: ids.depta, membershipId: ids.contractora, cap: 10, allowedVendorIds })).status).toBe(allowedVendorIds.length ? 400 : 400)
    expect((await action('leada', 'issue', { departmentId: ids.depta, membershipId: ids.employeea, cap: 10, allowedVendorIds: [vendor().id] })).status).toBe(409)
  })
  it('fails closed on mainnet, unexpected chain and unexpected asset', async () => {
    vi.stubEnv('TEMPO_NETWORK', 'mainnet')
    try { expect((await req('ownera')).status).toBe(503); expect((await action('ownera', 'provision')).status).toBe(503) } finally { vi.unstubAllEnvs() }
    adapter.chainId = 4217; expect((await req('ownera')).status).toBe(503)
    adapter.chainId = 42431; adapter.token = address('wrong'); expect((await req('ownera')).status).toBe(503)
  })
  it('rechecks permissions after an in-flight balance read before exposing records', async () => {
    await setup(); adapter.balances = async () => { mem('leada').active = false; return {} }
    expect((await req('leada')).status).toBe(403)
  })
})

describe('durable idempotency, concurrency and recovery', () => {
  it('replaying identical confirmed payload never signs or submits twice; changed payload conflicts', async () => {
    const card = await setup(), requestId = randomUUID(), body = { workspaceId: ids.a, requestId, action: 'spend', cardId: card, vendorId: vendor().id, amount: 25, note: 'Tools' }
    const first = await (await req('employeea', body)).json() as any, count = submitted.length
    expect(first.status).toBe('confirmed'); expect(await (await req('employeea', body)).json()).toEqual(first); expect(submitted).toHaveLength(count)
    expect((await req('employeea', { ...body, amount: 26 })).status).toBe(409)
    expect((await req('contractora', body)).status).toBe(403)
  })
  it('serializes competing workspace operations and allows another company to proceed', async () => {
    await setup(); let release!: () => void; pausePrepare = new Promise(resolve => { release = resolve })
    const id = randomUUID(), payload = { workspaceId: ids.a, requestId: id, action: 'fund', departmentId: ids.depta, amount: 10 }
    const inFlight = req('ownera', payload)
    await vi.waitFor(() => expect(wa().operations.at(-1)?.id).toBe(id))
    expect((await (await req('ownera', payload)).json()).status).toBe('pending')
    expect((await action('financea', 'fund', { departmentId: ids.depta, amount: 1 })).status).toBe(409)
    const b = action('ownerb', 'provision'); release(); pausePrepare = undefined
    expect((await inFlight).status).toBe(200); expect((await b).body.status).toBe('confirmed')
    expect(prepared.filter(c => c.operationId === id)).toHaveLength(1)
  })
  it('recovers a lost submit response from the stored receipt without creating another transfer', async () => {
    const card = await setup(), id = randomUUID()
    adapter.submit = async tx => { submitted.push(tx.raw); receipts.set(tx.hash, { status: 'confirmed', tx: tx.hash }); throw new Error('Connection lost after acceptance') }
    const details = { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' }
    expect((await action('employeea', 'spend', details, id)).body.status).toBe('pending')
    expect((await action('employeea', 'spend', details)).status).toBe(409)
    const count = submitted.length, signs = prepared.length
    expect((await action('employeea', 'spend', details, id)).body.status).toBe('confirmed')
    expect(submitted).toHaveLength(count); expect(prepared).toHaveLength(signs)
    expect(wa().receipts.filter(r => r.id === id)).toHaveLength(1)
  })
  it('only rebroadcasts identical persisted bytes after unknown transport failure', async () => {
    const card = await setup(), id = randomUUID(), details = { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' }
    submitError = new Error('Timeout')
    expect((await action('employeea', 'spend', details, id)).body.status).toBe('pending')
    const first = submitted.at(-1), count = prepared.length
    submitError = undefined
    expect((await action('employeea', 'spend', details, id)).body.status).toBe('confirmed')
    expect(prepared).toHaveLength(count); expect(submitted.at(-1)).toBe(first)
  })
  it('allows safe recovery from a crash before signing after the preparation lease expires', async () => {
    const card = await setup(), id = randomUUID(), details = { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' }
    pending = true; await action('employeea', 'spend', details, id)
    const op = wa().operations.find(o => o.id === id)!; delete op.prepared; delete op.tx; op.status = 'preparing'; op.lease = { token: 'crashed', until: 0 }
    pending = false
    expect((await action('employeea', 'spend', details, id)).body.status).toBe('confirmed')
  })
  it('does not send if durable signed-transaction storage fails', async () => {
    const card = await setup(), count = submitted.length, original = store.change
    let rejectSigned = true
    store.change = fn => original(s => {
      const out = fn(s)
      if (rejectSigned && Object.values((s as TestDirectory).pilot?.workspaces || {}).some(w => w.operations.some(o => o.status === 'prepared'))) { rejectSigned = false; throw Object.assign(new Error('Redis unavailable'), { status: 503 }) }
      return out
    })
    const result = await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' })
    expect(result.body.status).toBe('failed'); expect(submitted).toHaveLength(count)
  })
  it('treats unknown preparation failures as unsent failures, never as held policy requests', async () => {
    const card = await setup(), count = submitted.length
    prepareError = new Error('RPC unavailable')
    expect((await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' })).body.status).toBe('failed')
    expect(submitted).toHaveLength(count); expect(wa().requests).toEqual([])
  })
  it('does not accept a receipt for a different transaction hash', async () => {
    const card = await setup(); adapter.submit = async () => ({ status: 'confirmed', tx: hash('unrelated') })
    expect((await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 20, note: 'Tools' })).body.status).toBe('pending')
    expect(wa().receipts.filter(r => r.kind === 'spend')).toEqual([])
  })
  it('a confirmed revert creates no receipt and does not mark a payment paid', async () => {
    const card = await setup(), h = await held(card); adapter.submit = async tx => ({ status: 'reverted', tx: tx.hash })
    expect((await action('leada', 'approve', { heldId: h })).body.status).toBe('failed'); expect(wa().requests[0].status).toBe('held')
    expect(wa().receipts.some(r => r.kind === 'approve')).toBe(false)
  })
  it('approval retry never pays a held request twice after response loss', async () => {
    const card = await setup(), h = await held(card), id = randomUUID()
    adapter.submit = async tx => { submitted.push(tx.raw); receipts.set(tx.hash, { status: 'confirmed', tx: tx.hash }); throw new Error('Lost response') }
    expect((await action('leada', 'approve', { heldId: h }, id)).body.status).toBe('pending')
    const count = submitted.length
    expect((await action('leada', 'approve', { heldId: h }, id)).body.status).toBe('confirmed'); expect(submitted).toHaveLength(count)
    expect((await action('financea', 'approve', { heldId: h })).status).toBe(409)
  })
})

describe('revocation and membership integration', () => {
  it('blocks permission edits while keys are active, permits title-only changes, then permits edits after on-chain revocation', async () => {
    const card = await setup()
    expect(() => assertMembershipChangeSafe(state, mem('employeea'), { active: false })).toThrow(/Revoke/)
    expect(() => assertMembershipChangeSafe(state, mem('leada'), { role: 'employee' })).toThrow(/delegation/)
    expect(() => assertMembershipChangeSafe(state, mem('employeea'), {})).not.toThrow()
    expect((await action('ownera', 'undelegate', { departmentId: ids.depta })).status).toBe(409)
    await action('leada', 'revoke', { cardId: card })
    expect(() => assertMembershipChangeSafe(state, mem('employeea'), { active: false })).not.toThrow()
    expect((await action('ownera', 'undelegate', { departmentId: ids.depta })).body.status).toBe('confirmed')
    expect(() => assertMembershipChangeSafe(state, mem('leada'), { role: 'employee' })).not.toThrow()
    expect((await action('ownera', 'delegate', { departmentId: ids.depta, membershipId: ids.leada })).status).toBe(409)
  })
  it('blocks new spends immediately when revocation is pending and preserves that block on preparation failure', async () => {
    const card = await setup(); prepareError = new Error('Unavailable')
    expect((await action('leada', 'revoke', { cardId: card })).body.status).toBe('failed')
    expect(wa().cards[0].active).toBe(false); expect(wa().cards[0].revokePending).toBe(true)
    expect((await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 1, note: 'No' })).status).toBe(403)
    expect(() => assertMembershipChangeSafe(state, mem('employeea'), { active: false })).toThrow(/Revoke/)
    prepareError = undefined; expect((await action('financea', 'revoke', { cardId: card })).body.status).toBe('confirmed')
    expect(wa().cards[0].revokePending).toBe(false)
  })
  it('issues a unique replacement card key after successful revocation', async () => {
    const card = await setup(), key = wa().cards[0].keyAddress
    await action('leada', 'revoke', { cardId: card })
    const replacement = await action('leada', 'issue', { departmentId: ids.depta, membershipId: ids.employeea, cap: 10, allowedVendorIds: [vendor().id] })
    expect(replacement.body.status).toBe('confirmed'); expect(wa().cards[1].keyAddress).not.toBe(key)
  })
  it('blocks membership changes while a payment is unresolved', async () => {
    const card = await setup(); pending = true
    await action('employeea', 'spend', { cardId: card, vendorId: vendor().id, amount: 1, note: 'Waiting' })
    expect(() => assertMembershipChangeSafe(state, mem('employeea'), { active: false })).toThrow(/pending/)
  })
})
