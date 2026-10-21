import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Hono, Context } from 'hono'
import type { Directory, DirectoryStore, Membership } from './workspace-store.js'
import type { PilotActionResult, PilotActor, PilotAdapter, PilotAuth, PilotCommand, PilotInput, PilotLedger, PilotOperation, PilotWorkspace } from './pilot-types.js'

function fail(status: number, message: string): never { throw Object.assign(new Error(message), { status }) }
const manager = (m: Membership) => m.role === 'owner' || m.role === 'finance'
const unresolved = (op: PilotOperation) => ['preparing', 'prepared', 'pending'].includes(op.status)
const uuid = z.string().uuid()
const amount = z.number().finite().min(0.01).max(10000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, 'Use at most two decimal places.')
const base = { workspaceId: uuid, requestId: uuid }
const schema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('provision') }).strict(),
  z.object({ ...base, action: z.literal('fund'), departmentId: uuid, amount }).strict(),
  z.object({ ...base, action: z.literal('delegate'), departmentId: uuid, membershipId: uuid }).strict(),
  z.object({ ...base, action: z.literal('undelegate'), departmentId: uuid }).strict(),
  z.object({ ...base, action: z.literal('issue'), departmentId: uuid, membershipId: uuid, cap: amount, allowedVendorIds: z.array(z.string().min(1).max(100)).min(1).max(20) }).strict(),
  z.object({ ...base, action: z.literal('spend'), cardId: uuid, vendorId: z.string().min(1).max(100), amount, note: z.string().trim().min(1).max(200) }).strict(),
  z.object({ ...base, action: z.literal('approve'), heldId: uuid }).strict(),
  z.object({ ...base, action: z.literal('decline'), heldId: uuid }).strict(),
  z.object({ ...base, action: z.literal('revoke'), cardId: uuid }).strict(),
])
const blank = (): PilotWorkspace => ({ ready: false, departments: {}, cards: [], requests: [], receipts: [], operations: [] })
const ledger = (s: Directory): PilotLedger => {
  const state = s as Directory & { pilot?: PilotLedger }
  return state.pilot ||= { workspaces: {} }
}
const workspace = (s: Directory, id: string) => ledger(s).workspaces[id] ||= blank()
const fingerprint = (input: PilotInput) => createHash('sha256').update(JSON.stringify(input)).digest('hex')
const now = () => Date.now()
const audit = (s: Directory, op: PilotOperation, text: string) => s.audit.push({ id: randomUUID(), workspaceId: op.input.workspaceId, actorId: op.actorUserId, action: text, at: now() })
function enabled(adapter: PilotAdapter) {
  if (process.env.TEMPO_NETWORK === 'mainnet' || adapter.network !== 'testnet' || adapter.chainId !== 42431 || adapter.token.toLowerCase() !== '0x20c0000000000000000000000000000000000000') fail(503, 'Company pilots are available only on Tempo testnet with test dollars.')
}
function getDepartment(s: Directory, w: string, id?: string) {
  const d = s.departments.find(d => d.id === id && d.workspaceId === w)
  if (!d) fail(404, 'Department not found in this company.')
  return d!
}
function activeMember(s: Directory, w: string, id?: string, dept?: string) {
  const m = s.memberships.find(m => m.id === id && m.workspaceId === w && m.active && (!dept || m.departmentId === dept))
  if (!m) fail(404, 'That person does not have active access to this department.')
  return m!
}
function leadCan(s: Directory, w: PilotWorkspace, a: PilotActor, departmentId: string) {
  const d = w.departments[departmentId]
  const head = s.memberships.find(m => m.id === d?.headMembershipId && m.active && m.role === 'lead' && m.workspaceId === a.m.workspaceId && m.departmentId === departmentId)
  return a.m.role === 'lead' && a.m.departmentId === departmentId && head?.id === a.m.id && !d?.headRevoking
}
function reviewAccess(s: Directory, w: PilotWorkspace, a: PilotActor, departmentId: string) {
  if (!manager(a.m) && !leadCan(s, w, a, departmentId)) fail(403, 'Only Finance or this department’s delegated lead can do that.')
}

/** Block role, department or access changes while keys or unresolved payment operations still depend on this membership. */
export function assertMembershipChangeSafe(s: Directory, target: Membership, patch: { role?: string; departmentId?: string | null; active?: boolean }) {
  if ((patch.role === undefined || patch.role === target.role) && (patch.departmentId === undefined || (patch.departmentId || undefined) === target.departmentId) && (patch.active === undefined || patch.active === target.active)) return
  const w = (s as Directory & { pilot?: PilotLedger }).pilot?.workspaces[target.workspaceId]
  if (!w) return
  if (w.operations.some(op => unresolved(op) && (op.actorMembershipId === target.id || op.command.membershipId === target.id || op.command.headMembershipId === target.id))) fail(409, 'Finish the pending company payment operation before changing this person’s access.')
  if (w.cards.some(card => card.membershipId === target.id && (card.active || card.revokePending))) fail(409, 'Revoke this person’s spending card before changing their access.')
  if (Object.values(w.departments).some(d => d.headMembershipId === target.id)) fail(409, 'Revoke this lead’s department delegation before changing their access.')
}
export const assertPilotMembershipChangeAllowed = assertMembershipChangeSafe
export const pilotPaymentsReady = (s: Directory, workspaceId: string) => !!(s as Directory & { pilot?: PilotLedger }).pilot?.workspaces[workspaceId]?.ready

function commandFor(s: Directory, w: PilotWorkspace, a: PilotActor, input: PilotInput, adapter: PilotAdapter): PilotCommand {
  const cmd: PilotCommand = { workspaceId: input.workspaceId, operationId: input.requestId, action: input.action }
  const vendors = adapter.vendors(input.workspaceId)
  if (input.action === 'provision') {
    if (!manager(a.m)) fail(403, 'Only the owner or Finance can enable company test payments.')
    if (w.ready) fail(409, 'This company already has its test treasury.')
    return { ...cmd, amount: 10000, to: adapter.addresses(input.workspaceId).treasury }
  }
  if (!w.ready) fail(409, 'Ask the owner or Finance to enable test payments first.')
  if (['fund', 'delegate', 'undelegate', 'issue'].includes(input.action)) {
    const d = getDepartment(s, input.workspaceId, input.departmentId)
    cmd.departmentId = d.id
    const p = w.departments[d.id]
    if (input.action === 'fund') {
      if (!manager(a.m)) fail(403, 'Only the owner or Finance can fund departments.')
      return { ...cmd, amount: input.amount, to: adapter.addresses(input.workspaceId, d.id).department }
    }
    if (input.action === 'delegate') {
      if (!manager(a.m)) fail(403, 'Only the owner or Finance can delegate a department.')
      const target = activeMember(s, input.workspaceId, input.membershipId, d.id)
      if (target.role !== 'lead') fail(400, 'Choose a department lead with assigned access.')
      if (p?.headMembershipId) fail(409, 'Revoke the existing delegation before assigning another lead.')
      if (p?.retiredHeads?.includes(target.id)) fail(409, 'This membership’s signing key was revoked. Invite the lead into a new assigned membership before delegating again.')
      return { ...cmd, membershipId: target.id, headMembershipId: target.id }
    }
    if (input.action === 'undelegate') {
      if (!manager(a.m)) fail(403, 'Only the owner or Finance can revoke a department delegation.')
      if (!p?.headMembershipId) fail(409, 'This department has no delegated lead.')
      if (w.cards.some(card => card.departmentId === d.id && (card.active || card.revokePending))) fail(409, 'Revoke this department’s spending cards before revoking its lead.')
      return { ...cmd, membershipId: p.headMembershipId, headMembershipId: p.headMembershipId }
    }
    if (!leadCan(s, w, a, d.id)) fail(403, 'Only this department’s delegated lead can issue spending cards.')
    const target = activeMember(s, input.workspaceId, input.membershipId, d.id)
    if (!['lead', 'employee', 'contractor'].includes(target.role)) fail(400, 'Choose an employee, contractor or lead in this department.')
    if (w.cards.some(card => card.membershipId === target.id && (card.active || card.revokePending))) fail(409, 'Revoke the existing card before issuing a replacement.')
    const allowed = input.allowedVendorIds!
    if (new Set(allowed).size !== allowed.length || allowed.some(id => !vendors.some(v => v.id === id))) fail(400, 'Choose distinct test vendors from this company.')
    return { ...cmd, membershipId: target.id, headMembershipId: a.m.id, cardId: input.requestId, cap: input.cap, vendorAddresses: allowed.map(id => vendors.find(v => v.id === id)!.address) }
  }
  if (input.action === 'spend' || input.action === 'revoke') {
    const card = w.cards.find(card => card.id === input.cardId)
    if (!card) fail(404, 'Spending card not found in this company.')
    const target = activeMember(s, input.workspaceId, card.membershipId, card.departmentId)
    cmd.departmentId = card.departmentId; cmd.membershipId = card.membershipId; cmd.cardId = card.id
    if (input.action === 'revoke') {
      reviewAccess(s, w, a, card.departmentId)
      if (!card.active && !card.revokePending) fail(409, 'This spending card is already revoked.')
      return { ...cmd, headMembershipId: manager(a.m) ? undefined : a.m.id }
    }
    if (a.m.id !== target.id || a.user.id !== target.userId) fail(403, 'You can only spend with your own assigned card.')
    if (!card.active || card.revokePending) fail(403, 'This spending card has been revoked or is being revoked.')
    const vendor = vendors.find(v => v.id === input.vendorId)
    if (!vendor) fail(404, 'Choose a test vendor in this company.')
    return { ...cmd, amount: input.amount, to: vendor.address, note: input.note }
  }
  const held = w.requests.find(r => r.id === input.heldId)
  if (!held) fail(404, 'Payment request not found in this company.')
  reviewAccess(s, w, a, held.departmentId)
  if (held.status !== 'held') fail(409, 'This payment request has already been decided.')
  if (held.userId === a.user.id) fail(403, 'You cannot decide your own payment request. Ask another authorized approver.')
  if (held.amount > 1000 && !manager(a.m)) fail(403, 'Payments above 1,000 test dollars need Finance approval.')
  activeMember(s, input.workspaceId, held.membershipId, held.departmentId)
  const vendor = vendors.find(v => v.id === held.vendorId)
  if (!vendor) fail(409, 'This test vendor is no longer available.')
  return { ...cmd, departmentId: held.departmentId, membershipId: held.membershipId, cardId: held.cardId, amount: held.amount, to: vendor.address, note: held.note, headMembershipId: manager(a.m) ? undefined : a.m.id }
}

function viewResult(op: PilotOperation): PilotActionResult {
  return { status: unresolved(op) ? 'pending' : op.status as PilotActionResult['status'], operationId: op.id, ...(op.tx ? { tx: op.tx } : {}), ...(op.error ? { message: op.error } : {}) }
}
function finish(s: Directory, w: PilotWorkspace, op: PilotOperation, adapter: PilotAdapter) {
  const c = op.command
  if (op.status !== 'confirmed') return
  if (c.action === 'provision') w.ready = true
  if (c.departmentId) w.departments[c.departmentId] ||= { id: c.departmentId }
  if (c.action === 'delegate') Object.assign(w.departments[c.departmentId!], { headMembershipId: c.membershipId, headKey: adapter.addresses(c.workspaceId, c.departmentId, c.membershipId).headKey, headTx: op.tx, headRevoking: false })
  if (c.action === 'undelegate') {
    const d = w.departments[c.departmentId!]
    d.retiredHeads = [...new Set([...(d.retiredHeads || []), c.membershipId!])]
    delete d.headMembershipId; delete d.headKey; delete d.headTx; delete d.headRevoking
  }
  if (c.action === 'issue') w.cards.push({ id: c.cardId!, departmentId: c.departmentId!, membershipId: c.membershipId!, keyAddress: adapter.addresses(c.workspaceId, c.departmentId, c.membershipId, c.cardId).cardKey!, cap: c.cap!, allowedVendorIds: op.input.allowedVendorIds!, active: true, tx: op.tx, issuedBy: op.actorMembershipId, createdAt: now() })
  if (c.action === 'revoke') Object.assign(w.cards.find(card => card.id === c.cardId)!, { active: false, revokePending: false })
  if (c.action === 'approve') Object.assign(w.requests.find(r => r.id === op.input.heldId)!, { status: 'paid', tx: op.tx })
  if (c.action === 'decline') w.requests.find(r => r.id === op.input.heldId)!.status = 'declined'
  if (op.tx) w.receipts.push({ id: op.id, kind: c.action, departmentId: c.departmentId, membershipId: c.membershipId, amount: c.amount, tx: op.tx, at: now() })
  audit(s, op, `${c.action === 'decline' ? 'Declined' : 'Confirmed'} test payment action: ${c.action}`)
}
function hold(s: Directory, w: PilotWorkspace, op: PilotOperation, reason: string) {
  op.status = 'held'; op.error = reason; op.updatedAt = now(); delete op.lease
  w.requests.push({ id: op.id, departmentId: op.command.departmentId!, membershipId: op.command.membershipId!, userId: op.actorUserId, cardId: op.command.cardId!, vendorId: op.input.vendorId!, amount: op.command.amount!, note: op.command.note!, status: 'held', reason, at: now() })
  audit(s, op, 'Held a test payment for approval')
}

export function registerPilotRoutes(app: Hono, store: DirectoryStore, adapter: PilotAdapter, auth: PilotAuth) {
  app.get('/pilot', async c => {
    enabled(adapter)
    const s = await store.read(), a = auth(s, c), w = workspace(s, a.m.workspaceId)
    const companyId = a.m.workspaceId
    const departments = s.departments.filter(d => d.workspaceId === companyId && (manager(a.m) || d.id === a.m.departmentId))
    const canSeeDept = (id?: string) => manager(a.m) || !!id && a.m.role === 'lead' && id === a.m.departmentId
    const canSeeMember = (id?: string, departmentId?: string) => canSeeDept(departmentId) || id === a.m.id
    const treasuryAddress = adapter.addresses(companyId).treasury
    const addresses = departments.map(d => adapter.addresses(companyId, d.id).department!)
    if (manager(a.m)) addresses.push(treasuryAddress)
    const balances = await adapter.balances(addresses)
    // A membership could be revoked while the RPC was in flight. Recheck before exposing data.
    const fresh = auth(await store.read(), c)
    if (fresh.m.id !== a.m.id || fresh.m.role !== a.m.role || fresh.m.departmentId !== a.m.departmentId) fail(409, 'Your workspace access changed. Refresh before continuing.')
    return c.json({ network: adapter.network, chainId: adapter.chainId, token: adapter.token, workspaceId: companyId, ready: w.ready,
      treasury: manager(a.m) ? { address: treasuryAddress, balance: balances[treasuryAddress] ?? 0 } : null,
      departments: departments.map(d => ({ id: d.id, name: d.name, address: adapter.addresses(companyId, d.id).department!, balance: balances[adapter.addresses(companyId, d.id).department!] ?? 0, headMembershipId: w.departments[d.id]?.headMembershipId })),
      vendors: adapter.vendors(companyId),
      cards: w.cards.filter(card => canSeeMember(card.membershipId, card.departmentId)).map(card => ({ ...card, name: s.users.find(u => u.id === s.memberships.find(m => m.id === card.membershipId)?.userId)?.name || 'Team member' })),
      requests: w.requests.filter(r => canSeeMember(r.membershipId, r.departmentId)),
      receipts: w.receipts.filter(r => canSeeMember(r.membershipId, r.departmentId)).slice(-100).reverse(),
      operations: w.operations.filter(op => manager(a.m) || op.actorUserId === a.user.id || canSeeDept(op.command.departmentId)).slice(-100).reverse().map(op => ({ id: op.id, action: op.action, status: op.status, error: op.error, tx: op.tx })),
    })
  })

  app.post('/pilot/actions', async c => {
    enabled(adapter)
    const parsed = schema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: 'Check the payment fields, amount and request identifier.' }, 400)
    const input: PilotInput = parsed.data
    // Sorting prevents accidental semantically equivalent order differences without accepting altered content.
    if (input.allowedVendorIds) input.allowedVendorIds.sort()
    const fp = fingerprint(input), leaseToken = randomUUID()
    const claimed = await store.change(s => {
      const a = auth(s, c, input.workspaceId), w = workspace(s, input.workspaceId)
      let op = w.operations.find(op => op.id === input.requestId)
      if (op) {
        if (op.actorUserId !== a.user.id || op.actorMembershipId !== a.m.id) fail(403, 'Only the original account and assigned role can retry this operation.')
        if (op.fingerprint !== fp) fail(409, 'This request identifier is already attached to different payment details.')
        if (!unresolved(op)) return { op: structuredClone(op), prepare: false }
        // Current permissions still apply to new preparation. Stored signed operations may only reconcile/rebroadcast their identical bytes.
        if (!op.prepared) commandFor(s, w, a, input, adapter)
        if (op.lease && op.lease.until > now()) return { op: structuredClone(op), prepare: false }
      } else {
        if (w.operations.some(unresolved)) fail(409, 'A company payment is still being checked. Retry that pending operation before starting another.')
        const command = commandFor(s, w, a, input, adapter)
        op = { id: input.requestId, action: input.action, input, fingerprint: fp, actorUserId: a.user.id, actorMembershipId: a.m.id, command, status: 'preparing', createdAt: now(), updatedAt: now() }
        w.operations.push(op)
        if (input.action === 'revoke') Object.assign(w.cards.find(card => card.id === input.cardId)!, { active: false, revokePending: true })
        if (input.action === 'undelegate') w.departments[input.departmentId!]!.headRevoking = true
        if (input.action === 'decline') { op.status = 'confirmed'; finish(s, w, op, adapter); return { op: structuredClone(op), prepare: false } }
      }
      op.lease = { token: leaseToken, until: now() + 60000 }; op.updatedAt = now()
      return { op: structuredClone(op), prepare: !op.prepared }
    })
    let op = claimed.op
    if (!unresolved(op) || op.lease?.token !== leaseToken) return c.json(viewResult(op))
    if (claimed.prepare) {
      try {
        const prepared = await adapter.prepare(op.command)
        if (!/^0x[0-9a-f]+$/i.test(prepared.raw) || !/^0x[0-9a-f]{64}$/i.test(prepared.hash)) throw new Error('Invalid prepared transaction.')
        op = await store.change(s => {
          const a = auth(s, c, input.workspaceId), w = workspace(s, input.workspaceId), current = w.operations.find(x => x.id === input.requestId)!
          if (a.user.id !== current.actorUserId || a.m.id !== current.actorMembershipId) fail(403, 'The payment account changed.')
          if (current.lease?.token !== leaseToken) fail(409, 'Another request is checking this operation. Refresh its status.')
          // Permission changes are normally blocked by assertMembershipChangeSafe, and this recheck also protects alternate store writers.
          if (input.action !== 'revoke' && input.action !== 'undelegate') commandFor(s, w, a, input, adapter)
          current.prepared = prepared; current.status = 'prepared'; current.tx = prepared.hash; current.updatedAt = now()
          return structuredClone(current)
        })
      } catch (e: any) {
        // Never catch a failed signed-state persistence by sending the transaction anyway.
        return c.json(await store.change(s => {
          const w = workspace(s, input.workspaceId), current = w.operations.find(x => x.id === input.requestId)!
          if (current.lease?.token !== leaseToken || current.prepared) return viewResult(current)
          if (input.action === 'spend' && e?.code === 'POLICY_REJECTED') hold(s, w, current, 'This payment is outside your card’s spending rules. Your lead or Finance can review it.')
          else { current.status = 'failed'; current.error = e?.status ? e.message : 'The test payment could not be prepared. No payment was sent; refresh and try again.'; current.updatedAt = now(); delete current.lease }
          return viewResult(current)
        }))
      }
    }
    let result
    try {
      // Reading a receipt before resubmission recovers the response-lost case. Submitting identical bytes never creates another transfer.
      result = await adapter.status(op.prepared!)
      if (result.status === 'pending') result = await adapter.submit(op.prepared!)
    } catch { result = { status: 'pending' as const, tx: op.prepared!.hash, error: 'The network result is not confirmed yet. Retry this same operation to check it safely.' } }
    if (result.tx.toLowerCase() !== op.prepared!.hash.toLowerCase()) result = { status: 'pending', tx: op.prepared!.hash, error: 'The network result needs reconciliation. Retry this same operation.' }
    return c.json(await store.change(s => {
      const w = workspace(s, input.workspaceId), current = w.operations.find(x => x.id === input.requestId)!
      if (!unresolved(current)) return viewResult(current)
      if (current.prepared?.hash !== op.prepared!.hash) fail(409, 'The transaction being checked changed.')
      current.updatedAt = now(); delete current.lease
      if (result.status === 'pending') { current.status = 'pending'; current.error = result.error || 'Waiting for Tempo confirmation. Retry this operation to check it safely.' }
      else if (result.status === 'reverted') {
        if (input.action === 'spend' && result.error === 'POLICY_REJECTED') hold(s, w, current, 'This payment was rejected by your card’s spending rules. Your lead or Finance can review it.')
        else { current.status = 'failed'; current.error = 'Tempo rejected this transaction. No payment was completed.' }
      } else { current.status = 'confirmed'; delete current.error; finish(s, w, current, adapter) }
      return viewResult(current)
    }))
  })
}
