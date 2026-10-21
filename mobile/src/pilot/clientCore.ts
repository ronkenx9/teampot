import type { ActionDraft, ActionResult, Pairing, PendingAction, Pilot, Session, Snapshot, Workspace } from './types';

export class PilotError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = 'PilotError'; }
}
type Storage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
type Options = { base: string; storage: Storage; fetcher?: typeof fetch; uuid: () => string; now?: () => number };
const TOKEN = '0x20c0000000000000000000000000000000000000';
export function assertPilot(pilot: Pilot, workspaceId: string) {
  if (pilot?.network !== 'testnet' || pilot.chainId !== 42431 || pilot.token?.toLowerCase() !== TOKEN) throw new PilotError('This beta only supports Tempo testnet with test dollars.', 403);
  if (pilot.workspaceId !== workspaceId) throw new PilotError('Your workspace changed. Refresh before continuing.', 409);
}
export function pairingCode(value: string) { return value.trim().toUpperCase(); }
export function inviteToken(value: string) {
  let input = value.trim();
  try { if (/^https?:/i.test(input)) input = new URL(input).pathname; } catch { throw new PilotError('Paste a valid company invitation link.', 400); }
  const token = input.split('/').filter(Boolean).at(-1) || '';
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) throw new PilotError('Paste the full invitation link your company sent you.', 400);
  return token;
}
export function createPilotClient(options: Options) {
  const url = new URL(options.base);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS for company accounts.');
  const base = url.origin, fetcher = options.fetcher || fetch, storage = options.storage, now = options.now || Date.now;
  const scope = [...base].map(c => c.charCodeAt(0).toString(16)).join('');
  const key = (name: string) => `teampot.pilot.${scope}.${name}`;
  let generation = 0, busy = false;
  const readJSON = async <T>(name: string): Promise<T | null> => { const raw = await storage.get(key(name)); if (!raw) return null; try { return JSON.parse(raw); } catch { throw new PilotError('Saved company data could not be read. Sign out and reconnect.'); } };
  async function request<T>(path: string, body?: unknown, authenticated = true): Promise<T> {
    const token = authenticated ? await storage.get(key('token')) : null;
    if (authenticated && !token) throw new PilotError('Connect your company account to continue.', 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetcher(base + '/api/accounts' + path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (response.url && new URL(response.url).origin !== base) throw new PilotError('The company service redirected unexpectedly.');
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new PilotError(data?.error || 'The company service is unavailable. Please retry.', response.status);
      if (!data) throw new PilotError('The company service returned an incomplete response. Please retry.');
      return data as T;
    } catch (e) {
      if (e instanceof PilotError) throw e;
      throw new PilotError('Connection interrupted. Retry the saved request to check its result.');
    } finally { clearTimeout(timer); }
  }
  async function lock<T>(fn: () => Promise<T>) { if (busy) throw new PilotError('Wait for the current action to finish.', 409); busy = true; try { return await fn(); } finally { busy = false; } }
  async function session() { return request<Session>('/session'); }
  async function snapshot(): Promise<Snapshot> {
    const epoch = generation;
    const current = await session();
    if (!current.user) throw new PilotError('Your connection expired. Connect your account again.', 401);
    if (epoch !== generation) throw new PilotError('Your account changed. Refresh to continue.', 409);
    if (!current.activeMembershipId) return { session: current, workspace: null, pilot: null };
    const workspace = await request<Workspace>('/workspace');
    if (workspace.membership.id !== current.activeMembershipId || workspace.membership.userId !== current.user.id) throw new PilotError('Your assigned role changed. Refresh to continue.', 409);
    const pilot = await request<Pilot>('/pilot');
    assertPilot(pilot, workspace.workspace.id);
    if (epoch !== generation) throw new PilotError('Your account changed. Refresh to continue.', 409);
    return { session: current, workspace, pilot };
  }
  async function readPending(snap: Snapshot): Promise<PendingAction | null> {
    const uid = snap.session.user?.id, wid = snap.workspace?.workspace.id;
    if (!uid || !wid) return null;
    const pending = await readJSON<PendingAction>(`pending.${uid}.${wid}`);
    if (!pending) return null;
    if (pending.userId !== uid || pending.payload.workspaceId !== wid || !/^[a-f0-9-]{36}$/i.test(pending.payload.requestId)) throw new PilotError('Saved payment does not match this company. Contact the beta operator.');
    return pending;
  }
  async function validateContext(snap: Snapshot) {
    if (!snap.pilot || !snap.workspace || !snap.session.user) throw new PilotError('Open your company before continuing.', 403);
    assertPilot(snap.pilot, snap.workspace.workspace.id);
    const current = await session();
    if (current.user?.id !== snap.session.user.id || current.activeMembershipId !== snap.workspace.membership.id) throw new PilotError('Your account or workspace changed. Refresh before continuing.', 409);
    return { uid: current.user.id, wid: snap.workspace.workspace.id, mid: snap.workspace.membership.id };
  }
  async function sendPending(pending: PendingAction) {
    const result = await request<ActionResult>('/pilot/actions', pending.payload);
    if (!['confirmed', 'held', 'pending', 'failed'].includes(result.status)) throw new PilotError('The payment result is unclear. Retry the saved request.');
    if (result.status !== 'pending') await storage.remove(key(`pending.${pending.userId}.${pending.payload.workspaceId}`));
    return result;
  }
  return {
    base, request, snapshot, session, readPending,
    hasToken: async () => Boolean(await storage.get(key('token'))),
    async startPair(): Promise<Pairing> {
      return lock(async () => {
        generation++;
        const pair = await request<Pairing>('/mobile/start', {}, false);
        if (!pair.deviceId || !pair.pollingSecret || !pair.userCode || !Number.isFinite(pair.expiresAt) || new URL(pair.verificationUrl).origin !== base || !new URL(pair.verificationUrl).pathname.startsWith('/app')) throw new PilotError('Could not start a secure connection. Please retry.');
        await storage.set(key('pairing'), JSON.stringify(pair));
        return pair;
      });
    },
    async readPair() { const pair = await readJSON<Pairing>('pairing'); if (pair && pair.expiresAt <= now()) { await storage.remove(key('pairing')); return null; } return pair; },
    async pollPair(pair: Pairing) {
      const epoch = generation;
      if (pair.expiresAt <= now()) { await storage.remove(key('pairing')); throw new PilotError('This connection code expired. Start a new connection.', 410); }
      const result = await request<{ status: 'pending' | 'approved'; token?: string; expiresAt?: number }>('/mobile/poll', { deviceId: pair.deviceId, pollingSecret: pair.pollingSecret }, false);
      if (epoch !== generation) return false;
      if (result.status !== 'approved') return false;
      if (!result.token?.startsWith('tpm_') || !result.expiresAt || result.expiresAt <= now()) throw new PilotError('The device session was incomplete. Reconnect your account.');
      await storage.set(key('token'), result.token);
      if (epoch !== generation) { await storage.remove(key('token')); return false; }
      await storage.remove(key('pairing'));
      generation++;
      return true;
    },
    async action(snap: Snapshot, draft: ActionDraft): Promise<ActionResult> {
      return lock(async () => {
        const { uid, wid, mid } = await validateContext(snap);
        if (await readPending(snap)) throw new PilotError('Resolve your saved request before starting another action.', 409);
        const pending: PendingAction = { userId: uid, membershipId: mid, createdAt: now(), payload: { ...draft, workspaceId: wid, requestId: options.uuid() } };
        await storage.set(key(`pending.${uid}.${wid}`), JSON.stringify(pending));
        try { return await sendPending(pending); }
        catch (e) {
          // Validation/auth errors are definitive before a new operation; conflicts and transport errors may refer to a saved transaction.
          if (e instanceof PilotError && [400, 401, 403, 404, 422].includes(e.status)) await storage.remove(key(`pending.${uid}.${wid}`));
          throw e;
        }
      });
    },
    async retry(snap: Snapshot): Promise<ActionResult> {
      return lock(async () => { await validateContext(snap); const pending = await readPending(snap); if (!pending) throw new PilotError('There is no saved request to retry.', 404); if (pending.membershipId !== snap.workspace?.membership.id) throw new PilotError('Switch to the assigned role that started this saved request before checking it.', 409); return sendPending(pending); });
    },
    async switchMembership(snap: Snapshot, membershipId: string) {
      return lock(async () => {
        if (!snap.session.memberships.some(m => m.id === membershipId && m.active)) throw new PilotError('This role has not been assigned to your account.', 403);
        const pending = await readPending(snap);
        if (pending && pending.membershipId !== membershipId) throw new PilotError('Check your saved request before switching workspaces.', 409);
        generation++; await request('/switch', { membershipId });
      });
    },
    async setup(path: string, body: unknown) { return lock(() => request<any>(path, body)); },
    async logout() {
      generation++;
      try { if (await storage.get(key('token'))) await request('/logout', {}); }
      finally { await storage.remove(key('token')); await storage.remove(key('pairing')); }
    },
    async clearConnection() { generation++; await storage.remove(key('token')); await storage.remove(key('pairing')); }
  };
}
