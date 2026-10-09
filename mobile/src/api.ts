import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Held, Invoice, State, StockId } from './types';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://teampot.vercel.app').replace(/\/$/, '');
const COOKIE_KEY = 'teampot.session.cookie';
const PERSON_KEY = 'teampot.demo.person';

const rid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const local = {
  get(key: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  set(key: string, value: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  delete(key: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.removeItem(key);
  }
};

export async function readCookie() {
  if (Platform.OS === 'web') return local.get(COOKIE_KEY);
  return SecureStore.getItemAsync(COOKIE_KEY);
}

export async function saveCookie(cookie: string | null) {
  if (!cookie) return;
  const pair = cookie.split(';')[0];
  if (Platform.OS === 'web') local.set(COOKIE_KEY, pair);
  else await SecureStore.setItemAsync(COOKIE_KEY, pair);
}

export async function savePerson(personId: string) {
  if (Platform.OS === 'web') local.set(PERSON_KEY, personId);
  else await SecureStore.setItemAsync(PERSON_KEY, personId);
}

export async function readPerson() {
  if (Platform.OS === 'web') return local.get(PERSON_KEY);
  return SecureStore.getItemAsync(PERSON_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const cookie = await readCookie();
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (cookie && Platform.OS !== 'web') headers.set('cookie', cookie);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? 'include' : undefined
  });
  const setCookie = res.headers.get('set-cookie') ?? res.headers.get('Set-Cookie');
  await saveCookie(setCookie);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Teampot API request failed');
  return body as T;
}

export const api = {
  base: API_BASE,
  async demo(personId: string) {
    await savePerson(personId);
    return request<{ ok: true; demo: true; personId: string }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ personId })
    });
  },
  state() {
    return request<State>('/api/state');
  },
  spend(body: { personId: string; vendorId: string; amount: number; note: string }) {
    return request<{ ok: boolean; held?: Held; reason?: string; receipt?: string; tx?: string }>('/api/spend', {
      method: 'POST',
      body: JSON.stringify({ ...body, requestId: rid('mobile-spend') })
    });
  },
  decide(id: string, action: 'approve' | 'approve-add' | 'return', approverId: string) {
    return request<Held>(`/api/held/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ requestId: rid(`mobile-held-${id}`), approverId })
    });
  },
  election(body: { personId: string; stockId: StockId; percent: number }) {
    return request<{ ok: true; election: State['investments'][number]['election'] }>('/api/invest/election', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  trade(body: { personId: string; stockId: StockId; side: 'buy' | 'sell'; cashAmount?: number; shares?: number }) {
    return request<{ ok: true; stock: string; shares: number; price: number; tx: string; receipt: string }>('/api/invest/trade', {
      method: 'POST',
      body: JSON.stringify({ ...body, requestId: rid('mobile-trade') })
    });
  },
  invoice(body: { contractorId: string; amount: number; description: string }) {
    return request<Invoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ ...body, requestId: rid('mobile-invoice') })
    });
  },
  paydayPreview() {
    return request<{ date: string; total: number; lines: { personId: string; name: string; title: string; gross: number }[] }>('/api/payday/preview');
  },
  payday() {
    return request<{ ok: boolean; total: number; count: number; tx: string }>('/api/payday', {
      method: 'POST',
      body: JSON.stringify({ requestId: rid('mobile-payday') })
    });
  }
};

export function withPersona(state: State, personId: string): State {
  const person = state.people.find((p) => p.id === personId) ?? state.people.find((p) => p.id === 'sam')!;
  return { ...state, auth: { personId: person.id, role: person.role, demo: true } };
}
