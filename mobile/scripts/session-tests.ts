import assert from 'node:assert/strict';
import { ApiError, betaApiBase, createBetaClient, createFlightGuard, sessionCookie, validateBetaState, type Storage } from '../src/sessionCore';
import type { State } from '../src/types';

const betaState = (id = 'sam', network = 'testnet') => ({ auth: { personId: id, role: 'employee', demo: true }, people: [{ id, role: 'employee' }], company: { name: 'Fixture' }, earn: { network } }) as State;
function storageFixture() {
  const values = new Map<string, string>();
  const storage: Storage = { get: async key => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); }, remove: async key => { values.delete(key); } };
  return { values, storage };
}
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
function fixture() {
  const { values, storage } = storageFixture();
  const calls: { path: string; init?: RequestInit }[] = [];
  let handler: (path: string, init?: RequestInit) => Promise<Response> = async path => path === '/api/auth/demo' ? json({ ok: true, personId: 'sam', demo: true }, 200, { 'set-cookie': 'tp_session=test-session; Path=/; HttpOnly' }) : path === '/api/state' ? json(betaState()) : json({ ok: true });
  const client = createBetaClient({ base: 'https://example.com', native: true, storage, makeId: () => 'stable-id', fetcher: (async (url: string, init?: RequestInit) => { const path = new URL(url).pathname; calls.push({ path, init }); return handler(path, init); }) as typeof fetch });
  return { client, values, storage, calls, setHandler: (value: typeof handler) => { handler = value; } };
}
const rejects = (job: () => Promise<unknown>, status: number) => assert.rejects(job, (e: unknown) => e instanceof ApiError && e.status === status);
async function run() {
  let count = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => { await fn(); ++count; console.log(`ok ${count} - ${name}`); };
  await test('API origin requires HTTPS except loopback and never embeds credentials', () => {
    assert.equal(betaApiBase('https://example.com/'), 'https://example.com');
    assert.equal(betaApiBase('http://localhost:8081'), 'http://localhost:8081');
    assert.throws(() => betaApiBase('http://example.com')); assert.throws(() => betaApiBase('https://user:pass@example.com')); assert.throws(() => betaApiBase('https://example.com/path'));
  });
  await test('cookie parser accepts only the session cookie', () => {
    assert.equal(sessionCookie('other=oops; Path=/'), null); assert.equal(sessionCookie('tp_session=; Max-Age=0'), null);
    assert.equal(sessionCookie('tp_session=abc.def; Path=/; HttpOnly'), 'tp_session=abc.def');
  });
  await test('server identity and network are authoritative', () => {
    assert.equal(validateBetaState(betaState(), 'sam').auth?.personId, 'sam');
    assert.throws(() => validateBetaState(betaState('ava'), 'sam'));
    assert.throws(() => validateBetaState({ ...betaState(), auth: { personId: 'sam', role: 'admin', demo: true } }, 'sam'));
    assert.throws(() => validateBetaState({ ...betaState(), auth: { personId: 'sam', role: 'employee', demo: false } }, 'sam'));
    assert.throws(() => validateBetaState(betaState('sam', 'mainnet'), 'sam'));
    assert.throws(() => validateBetaState({ ...betaState(), earn: undefined }, 'sam'));
    assert.throws(() => validateBetaState({ ...betaState(), company: { ...betaState().company, network: 'mainnet' } }, 'sam'));
  });
  await test('fresh install makes no login or state request', async () => {
    const f = fixture(); assert.equal(await f.client.restore(), null); assert.equal(f.calls.length, 0);
    await rejects(() => f.client.mutate('/api/spend', { amount: 1 }), 401); assert.equal(f.calls.length, 0);
  });
  await test('failed login never persists selected profile or credential', async () => {
    const f = fixture(); f.setHandler(async () => json({ error: 'Demo disabled' }, 403));
    await rejects(() => f.client.login('sam'), 403); assert.equal(await f.client.readSession(), null); assert.equal(f.values.size, 0);
  });
  await test('login requires network verification before persisting credential', async () => {
    const f = fixture(); f.setHandler(async path => path === '/api/auth/demo' ? json({ ok: true, demo: true, personId: 'sam' }, 200, { 'set-cookie': 'tp_session=token' }) : json(betaState('sam', 'mainnet')));
    await rejects(() => f.client.login('sam'), 403); assert.equal(await f.client.readSession(), null);
  });
  await test('native login atomically saves verified identity and credential; restore sends cookie without relogin', async () => {
    const f = fixture(); await f.client.login('sam');
    assert.deepEqual(await f.client.readSession(), { personId: 'sam', cookie: 'tp_session=test-session' });
    const loginCount = f.calls.filter(c => c.path === '/api/auth/demo').length;
    await f.client.restore(); assert.equal(f.calls.filter(c => c.path === '/api/auth/demo').length, loginCount);
    assert.equal(new Headers(f.calls.at(-1)?.init?.headers).get('cookie'), 'tp_session=test-session');
  });
  await test('401 clears persisted credential without reauthenticating', async () => {
    const f = fixture(); await f.client.login('sam'); const loginCount = f.calls.length;
    f.setHandler(async () => json({ error: 'Expired' }, 401)); await rejects(() => f.client.state(), 401);
    assert.equal(await f.client.readSession(), null); assert.equal(f.calls.length, loginCount + 1);
  });
  await test('network transition blocks action before any payment request', async () => {
    const f = fixture(); await f.client.login('sam'); f.setHandler(async () => json(betaState('sam', 'mainnet')));
    await rejects(() => f.client.mutate('/api/spend', { amount: 1 }), 403);
    assert.equal(f.calls.filter(c => c.path === '/api/spend').length, 0); assert.equal(await f.client.readSession(), null);
  });
  await test('uncertain action survives logout and exact retry keeps its request ID', async () => {
    const f = fixture(); await f.client.login('sam');
    f.setHandler(async path => path === '/api/state' ? json(betaState()) : json({ error: 'upstream timeout' }, 504));
    await rejects(() => f.client.mutate('/api/spend', { amount: 1 }), 504);
    const first = JSON.parse(String(f.calls.find(c => c.path === '/api/spend')?.init?.body));
    await rejects(() => f.client.mutate('/api/spend', { amount: 2 }), 409);
    assert.equal(f.calls.filter(c => c.path === '/api/spend').length, 1);
    await f.client.logout(); assert.equal(await f.client.readSession(), null); assert.equal([...f.values.keys()].filter(k => k.includes('.pending.')).length, 1);
    f.setHandler(async path => path === '/api/auth/demo' ? json({ ok: true, demo: true, personId: 'sam' }, 200, { 'set-cookie': 'tp_session=token' }) : path === '/api/state' ? json(betaState()) : json({ ok: true }));
    await f.client.login('sam'); await f.client.mutate('/api/spend', { amount: 1 });
    const last = JSON.parse(String(f.calls.filter(c => c.path === '/api/spend').at(-1)?.init?.body));
    assert.equal(last.requestId, first.requestId); assert.equal([...f.values.keys()].filter(k => k.includes('.pending.')).length, 0);
  });
  await test('definitive errors preserve API message and allow corrected request', async () => {
    const f = fixture(); await f.client.login('sam'); f.setHandler(async path => path === '/api/state' ? json(betaState()) : json({ error: 'Amount exceeds your card limit' }, 400));
    await assert.rejects(() => f.client.mutate('/api/spend', { amount: 9999 }), /Amount exceeds your card limit/);
    assert.equal([...f.values.keys()].filter(k => k.includes('.pending.')).length, 0);
  });
  await test('double submit sends one financial request', async () => {
    const f = fixture(); await f.client.login('sam');
    let resolve!: (v: Response) => void;
    f.setHandler(async path => path === '/api/state' ? json(betaState()) : new Promise<Response>(r => { resolve = r; }));
    const first = f.client.mutate('/api/spend', { amount: 1 });
    await rejects(() => f.client.mutate('/api/spend', { amount: 1 }), 409);
    await new Promise(r => setTimeout(r, 0)); resolve(json({ ok: true })); await first;
    assert.equal(f.calls.filter(c => c.path === '/api/spend').length, 1);
  });
  await test('late sign-in cannot restore a cleared session', async () => {
    const f = fixture(); let resolve!: (v: Response) => void;
    f.setHandler(async path => path === '/api/auth/demo' ? new Promise<Response>(r => { resolve = r; }) : json(betaState()));
    const login = f.client.login('sam'); await new Promise(r => setTimeout(r, 0));
    await f.client.clearSession(); resolve(json({ ok: true, demo: true, personId: 'sam' }, 200, { 'set-cookie': 'tp_session=token' }));
    await rejects(() => login, 401); assert.equal(await f.client.readSession(), null);
  });
  await test('late expired state response cannot clear a newer session', async () => {
    const f = fixture(); await f.client.login('sam'); let resolve!: (v: Response) => void;
    f.setHandler(async () => new Promise<Response>(r => { resolve = r; }));
    const oldState = f.client.state(); await new Promise(r => setTimeout(r, 0));
    f.setHandler(async path => path === '/api/auth/demo' ? json({ ok: true, demo: true, personId: 'sam' }, 200, { 'set-cookie': 'tp_session=new-session' }) : json(betaState()));
    await f.client.login('sam'); resolve(json({ error: 'expired' }, 401));
    await rejects(() => oldState, 401); assert.equal((await f.client.readSession())?.cookie, 'tp_session=new-session');
  });
  await test('timeout aborts a request and retains unresolved payment identity', async () => {
    const { storage, values } = storageFixture();
    const client = createBetaClient({ base: 'https://example.com', native: true, storage, timeoutMs: 10, fetcher: (async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path === '/api/auth/demo') return json({ ok: true, demo: true, personId: 'sam' }, 200, { 'set-cookie': 'tp_session=token' });
      if (path === '/api/state') return json(betaState());
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    }) as typeof fetch });
    await client.login('sam'); await assert.rejects(() => client.mutate('/api/spend', { amount: 1 }), (e: unknown) => e instanceof ApiError && e.uncertain && e.message.includes('too long'));
    assert.equal([...values.keys()].filter(k => k.includes('.pending.')).length, 1);
  });
  await test('synchronous provider guard prevents overlapping operations', () => { const guard = createFlightGuard(); assert.equal(guard.acquire(), true); assert.equal(guard.acquire(), false); guard.release(); assert.equal(guard.acquire(), true); });
  console.log(`BETA_SESSION_TESTS_OK (${count} cases)`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
