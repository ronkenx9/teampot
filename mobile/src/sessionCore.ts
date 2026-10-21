import type { State } from './types';

export class ApiError extends Error {
  constructor(message: string, public status = 0, public uncertain = false) { super(message); this.name = 'ApiError'; }
}

export function validateBetaState(state: State, personId: string): State {
  const auth = state?.auth;
  const person = state?.people?.find(p => p.id === personId);
  if (!auth || auth.demo !== true || auth.personId !== personId || !person || person.role !== auth.role) {
    throw new ApiError('Your session changed. Choose a beta profile again.', 401);
  }
  const networks = [state.earn?.network, state.company?.network].filter(v => v !== undefined);
  if (!networks.length || networks.some(network => network !== 'testnet')) {
    throw new ApiError('This beta only connects to Tempo testnet. No action was sent.', 403);
  }
  return state;
}

export function createFlightGuard() {
  let active = false;
  return {
    acquire() { if (active) return false; active = true; return true; },
    release() { active = false; },
    get active() { return active; }
  };
}

export type SessionRecord = { personId: string; cookie: string | null };
export type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
type Pending = { signature: string; requestId: string };
type Options = { base: string; native: boolean; storage: Storage; fetcher?: typeof fetch; timeoutMs?: number; makeId?: () => string };

const isLocal = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
const demoIds = new Set(['sam', 'ava', 'mateo', 'jordan']);
export function betaApiBase(input: string) {
  const url = new URL(input);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('API base must be an origin without credentials or a path.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal(url.hostname))) throw new Error('Teampot requires HTTPS outside localhost.');
  return url.origin;
}

/** Only accept the expected opaque session cookie, never an unrelated Set-Cookie value. */
export function sessionCookie(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(?:^|,\s*)tp_session=([^;,\s]+)/);
  return match ? `tp_session=${match[1]}` : null;
}

export function createBetaClient(options: Options) {
  const base = betaApiBase(options.base);
  const { storage, native } = options;
  const fetcher = options.fetcher || fetch;
  const key = `teampot.beta.session.${encodeURIComponent(base).replace(/%/g, '_')}`;
  const pendingKey = (personId: string) => `${key}.pending.${personId}`;
  let revision = 0;
  let verified: SessionRecord | null = null;
  let storageQueue = Promise.resolve();
  // A late response or storage write cannot put a signed-out account back into SecureStore.
  function serialized<T>(job: () => Promise<T>): Promise<T> {
    const next = storageQueue.then(job, job); storageQueue = next.then(() => {}, () => {}); return next;
  }
  async function readSession(): Promise<SessionRecord | null> {
    await storageQueue;
    const raw = await storage.get(key);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as SessionRecord;
      if (!demoIds.has(value.personId) || (native && (!value.cookie || sessionCookie(value.cookie) !== value.cookie))) throw new Error();
      return { personId: value.personId, cookie: native ? value.cookie : null };
    } catch { await serialized(() => storage.remove(key)); return null; }
  }
  async function clearSession() {
    ++revision; verified = null;
    await serialized(async () => {
      await storage.remove(key);
      // Remove credentials left by the earlier prototype as well.
      await storage.remove('teampot.session.cookie');
      await storage.remove('teampot.demo.person');
    });
  }
  async function http<T>(path: string, init: RequestInit = {}, cookie: string | null = null): Promise<{ body: T; cookie: string | null }> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('content-type', 'application/json');
    if (native && cookie) headers.set('cookie', cookie);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
    const mutating = (init.method || 'GET') !== 'GET';
    try {
      const response = await fetcher(`${base}${path}`, { ...init, headers, credentials: native ? 'omit' : 'include', signal: controller.signal });
      let body: any;
      try { body = await response.json(); } catch { throw new ApiError('Teampot returned an unreadable response. Check activity before retrying.', response.status, mutating); }
      if (!response.ok) throw new ApiError(typeof body?.error === 'string' ? body.error : `Teampot could not complete this request (${response.status}).`, response.status, mutating && (response.status >= 500 || response.status === 408 || response.status === 409));
      return { body: body as T, cookie: sessionCookie(response.headers.get('set-cookie')) };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'Teampot took too long to respond. Check activity before retrying.' : "Can't reach Teampot. Check your connection and retry.", 0, mutating);
    } finally { clearTimeout(timeout); }
  }
  async function stateFor(session: SessionRecord): Promise<State> {
    const { body } = await http<State>('/api/state', {}, session.cookie);
    return validateBetaState(body, session.personId);
  }
  async function restore(): Promise<State | null> {
    const current = revision;
    const session = await readSession();
    if (current !== revision) return null;
    if (!session) { verified = null; return null; }
    try {
      const state = await stateFor(session);
      if (current !== revision) return null;
      verified = session;
      return state;
    } catch (error) {
      if (current === revision && error instanceof ApiError && [401, 403].includes(error.status)) await clearSession();
      throw error;
    }
  }
  async function login(personId: string): Promise<State> {
    if (!demoIds.has(personId)) throw new ApiError('Choose one of the available beta profiles.', 400);
    await clearSession();
    const current = revision;
    const { body, cookie } = await http<{ ok: boolean; demo: boolean; personId: string }>('/api/auth/demo', { method: 'POST', body: JSON.stringify({ personId }) });
    if (current !== revision) throw new ApiError('Sign-in was cancelled.', 401);
    if (!body.ok || body.demo !== true || body.personId !== personId || (native && !cookie)) throw new ApiError('Teampot could not establish a beta session. Try again.', 401);
    const session = { personId, cookie: native ? cookie : null };
    const state = await stateFor(session);
    await serialized(async () => {
      if (current !== revision) throw new ApiError('Sign-in was cancelled.', 401);
      await storage.set(key, JSON.stringify(session));
      if (current === revision) verified = session;
    });
    if (current !== revision) throw new ApiError('Sign-in was cancelled.', 401);
    return state;
  }
  async function authenticated<T>(path: string, init: RequestInit = {}): Promise<T> {
    const session = verified;
    if (!session) throw new ApiError('Choose a beta profile to continue.', 401);
    const current = revision;
    try {
      const { body } = await http<T>(path, init, session.cookie);
      if (current !== revision) throw new ApiError('Your session changed.', 401);
      return body;
    } catch (error) {
      if (current === revision && error instanceof ApiError && error.status === 401) await clearSession();
      throw error;
    }
  }
  async function state(): Promise<State> {
    const current = revision;
    const session = verified;
    if (!session) throw new ApiError('Choose a beta profile to continue.', 401);
    try { return validateBetaState(await authenticated<State>('/api/state'), session.personId); }
    catch (error) { if (current === revision && error instanceof ApiError && [401, 403].includes(error.status)) await clearSession(); throw error; }
  }
  const actionFlight = createFlightGuard();
  async function mutate<T>(path: string, data: Record<string, unknown>, idempotent = true): Promise<T> {
    if (!actionFlight.acquire()) throw new ApiError('Wait for the current action to finish.', 409);
    const session = verified;
    const current = revision;
    try {
      if (!session) throw new ApiError('Choose a beta profile to continue.', 401);
      // Recheck the network and signed-in actor immediately before every write.
      await state();
      if (verified !== session) throw new ApiError('Your session changed.', 401);
      const signature = JSON.stringify({ path, data });
      const raw = await storage.get(pendingKey(session.personId));
      const previous = raw ? JSON.parse(raw) as Pending : null;
      if (previous && previous.signature !== signature) throw new ApiError('A previous action has an unknown result. Review activity, then retry that exact action to reconcile it before starting another.', 409, true);
      const pending = previous ?? { signature, requestId: options.makeId?.() ?? `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      // Persist before sending; a retry after a timeout/restart keeps the same request id.
      await storage.set(pendingKey(session.personId), JSON.stringify(pending));
      if (current !== revision || verified !== session) throw new ApiError('Your session changed. No new action was sent.', 401);
      try {
        const result = await authenticated<T>(path, { method: 'POST', body: JSON.stringify({ ...data, ...(idempotent ? { requestId: pending.requestId } : {}) }) });
        await storage.remove(pendingKey(session.personId));
        return result;
      } catch (error) {
        if (error instanceof ApiError && !error.uncertain && error.status !== 401) await storage.remove(pendingKey(session.personId));
        throw error;
      }
    } finally { actionFlight.release(); }
  }
  async function logout() {
    const cookie = verified?.cookie || null;
    await clearSession();
    // Local sign-out is authoritative even if the network is unavailable.
    try { await http('/api/auth/logout', { method: 'POST' }, cookie); } catch { /* no local credential remains */ }
  }
  return { base, key, readSession, clearSession, login, restore, state, authenticated, mutate, logout };
}
