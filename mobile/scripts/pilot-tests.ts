import assert from 'node:assert/strict';
import { createPilotClient, assertPilot, inviteToken } from '../src/pilot/clientCore';
import type { Membership, Pilot, Session, Workspace } from '../src/pilot/types';

const BASE = 'https://pilot.example', TOKEN = '0x20c0000000000000000000000000000000000000';
const member: Membership = { id: 'member-a', userId: 'user-a', workspaceId: 'company-a', role: 'employee', departmentId: 'dept-a', title: 'Designer', active: true };
const pilot: Pilot = { network: 'testnet', chainId: 42431, token: TOKEN, workspaceId: 'company-a', ready: true, treasury: null, departments: [], vendors: [], cards: [], requests: [], receipts: [], operations: [] };
const workspace: Workspace = { workspace: { id: 'company-a', name: 'Company A' }, membership: member, people: [member], departments: [], invites: [], audit: [], paymentsReady: true };
const clone = <T>(value: T): T => structuredClone(value);
function fixture() {
  const saved = new Map<string, string>(), calls: { path: string; body: any; headers: Record<string, string> }[] = [];
  let currentSession: Session = { user: { id: 'user-a', name: 'Alex' }, memberships: [clone(member)], activeMembershipId: member.id };
  let currentWorkspace = clone(workspace), currentPilot = clone(pilot), actionResult: any = { status: 'confirmed', operationId: 'op-a', tx: '0x' + 'a'.repeat(64) }, failSend = false, failStorage = false, approved = true, pairURL = BASE + '/app?device=device-a&code=ABCD-EFGH', now = 1_000;
  const storage = { async get(key: string) { return saved.get(key) || null; }, async set(key: string, value: string) { if (failStorage && key.includes('.pending.')) throw new Error('storage full'); saved.set(key, value); }, async remove(key: string) { saved.delete(key); } };
  const fetcher = async (input: any, init: any) => {
    const path = new URL(String(input)).pathname.replace('/api/accounts', '');
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, headers: init.headers });
    let data: any;
    if (path === '/mobile/start') data = { deviceId: 'device-a', pollingSecret: 'secret-on-phone', userCode: 'ABCD-EFGH', verificationUrl: pairURL, expiresAt: 100_000 };
    else if (path === '/mobile/poll') data = approved ? { status: 'approved', token: 'tpm_phone-session', expiresAt: 200_000 } : { status: 'pending' };
    else if (path === '/session') data = currentSession;
    else if (path === '/workspace') data = currentWorkspace;
    else if (path === '/pilot') data = currentPilot;
    else if (path === '/pilot/actions') { assert([...saved.keys()].some(k => k.includes('.pending.')), 'intent must be durable before network send'); if (failSend) throw new Error('connection lost'); data = actionResult; }
    else if (path === '/switch') { currentSession.activeMembershipId = body.membershipId; data = { ok: true }; }
    else if (path === '/logout') data = { ok: true };
    else data = { ok: true };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  let id = 0;
  const options = { base: BASE, storage, fetcher: fetcher as typeof fetch, uuid: () => `11111111-1111-4111-8111-${String(++id).padStart(12, '0')}`, now: () => now };
  const client = createPilotClient(options);
  return {
    client, options, saved, calls,
    set failure(v: boolean) { failSend = v; }, set storageFailure(v: boolean) { failStorage = v; }, set result(v: any) { actionResult = v; }, set approved(v: boolean) { approved = v; }, set time(v: number) { now = v; }, set pairURL(v: string) { pairURL = v; },
    set session(v: Session) { currentSession = clone(v); }, get session() { return currentSession; }, set workspace(v: Workspace) { currentWorkspace = clone(v); }, set pilot(v: Pilot) { currentPilot = clone(v); },
    async connect() { const pair = await client.startPair(); assert.equal(await client.pollPair(pair), true); return client.snapshot(); }
  };
}
let count = 0;
async function test(name: string, fn: () => void | Promise<void>) { await fn(); count++; console.log(`PASS ${name}`); }
await test('Only Moderato and the matching asset/workspace are accepted', () => {
  assertPilot(pilot, 'company-a');
  assert.throws(() => assertPilot({ ...pilot, chainId: 4217 }, 'company-a'), /testnet/);
  assert.throws(() => assertPilot({ ...pilot, token: '0xother' }, 'company-a'), /testnet/);
  assert.throws(() => assertPilot(pilot, 'company-b'), /workspace changed/);
});
await test('Pairing uses a phone secret and scoped bearer, never a demo identity', async () => {
  const f = fixture(); const snap = await f.connect();
  assert.equal(snap.session.user?.id, 'user-a');
  assert.deepEqual(f.calls.find(c => c.path === '/mobile/poll')?.body, { deviceId: 'device-a', pollingSecret: 'secret-on-phone' });
  assert.equal(f.calls.find(c => c.path === '/session')?.headers.Authorization, 'Bearer tpm_phone-session');
  assert.equal(f.calls.some(c => c.path.includes('demo')), false);
});
await test('Unapproved and expired connections cannot create a session', async () => {
  const f = fixture(); f.approved = false; const pair = await f.client.startPair();
  assert.equal(await f.client.pollPair(pair), false); assert.equal(await f.client.hasToken(), false);
  f.time = 110_000; await assert.rejects(f.client.pollPair(pair), /expired/);
});
await test('Pairing cannot navigate to another service origin', async () => {
  const f = fixture(); f.pairURL = 'https://attacker.example/app'; await assert.rejects(f.client.startPair(), /secure connection/);
});
await test('Confirmed actions clear durable intent only after a result', async () => {
  const f = fixture(), snap = await f.connect(); const result = await f.client.action(snap, { action: 'spend', cardId: 'card-a', vendorId: 'vendor-a', amount: 10, note: 'Tools' });
  assert.equal(result.status, 'confirmed'); assert.equal(await f.client.readPending(snap), null);
  const body = f.calls.find(c => c.path === '/pilot/actions')?.body;
  assert.equal(body.workspaceId, 'company-a'); assert.equal(body.requestId, '11111111-1111-4111-8111-000000000001'); assert.equal(body.role, undefined);
});
await test('Ambiguous delivery survives restart and retries identical bytes', async () => {
  const f = fixture(), snap = await f.connect(); f.failure = true;
  await assert.rejects(f.client.action(snap, { action: 'spend', cardId: 'card-a', vendorId: 'vendor-a', amount: 11, note: 'License' }), /Connection interrupted/);
  const pending = await f.client.readPending(snap); assert(pending);
  await assert.rejects(f.client.action(snap, { action: 'spend', amount: 99 }), /Resolve your saved request/);
  const restarted = createPilotClient(f.options); f.failure = false; await restarted.retry(snap);
  const sends = f.calls.filter(c => c.path === '/pilot/actions'); assert.equal(sends.length, 2); assert.deepEqual(sends[0].body, sends[1].body); assert.equal(await restarted.readPending(snap), null);
});
await test('Pending result stays saved and blocks workspace switching', async () => {
  const f = fixture(), snap = await f.connect(); f.result = { status: 'pending', operationId: 'op-a' };
  await f.client.action(snap, { action: 'spend', amount: 10 }); assert(await f.client.readPending(snap));
  snap.session.memberships.push({ ...member, id: 'member-b', workspaceId: 'company-b' });
  await assert.rejects(f.client.switchMembership(snap, 'member-b'), /saved request/);
});
await test('Storage failure prevents sending a payment', async () => {
  const f = fixture(), snap = await f.connect(); f.storageFailure = true;
  await assert.rejects(f.client.action(snap, { action: 'spend', amount: 10 }), /storage full/);
  assert.equal(f.calls.filter(c => c.path === '/pilot/actions').length, 0);
});
await test('Stale company and self-selected roles cannot send or switch', async () => {
  const f = fixture(), snap = await f.connect();
  f.session = { ...f.session, activeMembershipId: 'changed-member' };
  await assert.rejects(f.client.action(snap, { action: 'spend', amount: 10 }), /account or workspace changed/);
  await assert.rejects(f.client.switchMembership(snap, 'owner-role-invented'), /not been assigned/);
  assert.equal(f.calls.filter(c => c.path === '/pilot/actions').length, 0);
});
await test('Different users do not inherit another person’s saved payment', async () => {
  const f = fixture(), snap = await f.connect(); f.failure = true;
  await assert.rejects(f.client.action(snap, { action: 'spend', amount: 10 }));
  const other = clone(snap); other.session.user = { id: 'other-user', name: 'Other' };
  assert.equal(await f.client.readPending(other), null);
  assert(await f.client.readPending(snap));
});
await test('Logout clears token while retaining retry identity for the same account', async () => {
  const f = fixture(), snap = await f.connect(); f.failure = true;
  await assert.rejects(f.client.action(snap, { action: 'spend', amount: 10 }));
  await f.client.logout(); assert.equal(await f.client.hasToken(), false); assert(await f.client.readPending(snap));
  await assert.rejects(f.client.snapshot(), /Connect your company account/);
  assert(f.calls.some(c => c.path === '/logout'));
});
await test('Saved sessions are isolated by service origin', async () => {
  const f = fixture(); await f.connect(); const other = createPilotClient({ ...f.options, base: 'https://different.example' });
  assert.equal(await other.hasToken(), false);
});
await test('Returning under another assigned role cannot retry the original action', async () => {
  const f = fixture(), snap = await f.connect(); f.failure = true; await assert.rejects(f.client.action(snap, { action: 'spend', amount: 10 }));
  const other = clone(snap); other.workspace!.membership.id = 'other-membership'; other.session.activeMembershipId = 'other-membership'; f.session = other.session;
  await assert.rejects(f.client.retry(other), /assigned role that started/);
});
await test('Invitation parsing accepts a full link but rejects arbitrary text', () => {
  const token = 'a'.repeat(43); assert.equal(inviteToken(BASE + '/join/' + token), token); assert.throws(() => inviteToken('please make me owner'), /invitation link/);
});
console.log(`pilot mobile checks passed (${count})`);
