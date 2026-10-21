import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createBetaClient } from './sessionCore';
import type { Held, Invoice, State, StockId } from './types';
export { ApiError } from './sessionCore';

const client = createBetaClient({
  base: process.env.EXPO_PUBLIC_API_BASE || 'https://teampot.vercel.app',
  native: Platform.OS !== 'web',
  storage: {
    async get(key) { return Platform.OS === 'web' ? (typeof window === 'undefined' ? null : window.localStorage.getItem(key)) : SecureStore.getItemAsync(key); },
    async set(key, value) { if (Platform.OS === 'web') window.localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
    async remove(key) { if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } else await SecureStore.deleteItemAsync(key); }
  }
});

export const api = {
  base: client.base,
  restore: client.restore,
  session: client.readSession,
  signOut: client.logout,
  clearSession: client.clearSession,
  async demo(personId: string) {
    const state = await client.login(personId);
    return { ok: true as const, demo: true as const, personId, state };
  },
  state: client.state,
  spend(body: { personId: string; vendorId: string; amount: number; note: string }) {
    return client.mutate<{ ok: boolean; held?: Held; reason?: string; receipt?: string; tx?: string }>('/api/spend', body);
  },
  decide(id: string, action: 'approve' | 'approve-add' | 'return', approverId: string) {
    return client.mutate<Held>(`/api/held/${encodeURIComponent(id)}/${action}`, { approverId });
  },
  election(body: { personId: string; stockId: StockId; percent: number }) {
    return client.mutate<{ ok: true; election: State['investments'][number]['election'] }>('/api/invest/election', body, false);
  },
  trade(body: { personId: string; stockId: StockId; side: 'buy' | 'sell'; cashAmount?: number; shares?: number }) {
    return client.mutate<{ ok: true; stock: string; shares: number; price: number; tx: string; receipt: string }>('/api/invest/trade', body);
  },
  invoice(body: { contractorId: string; amount: number; description: string }) {
    return client.mutate<Invoice>('/api/invoices', body);
  },
  paydayPreview() {
    return client.authenticated<{ date: string; total: number; lines: { personId: string; name: string; title: string; gross: number }[] }>('/api/payday/preview');
  },
  payday() {
    return client.mutate<{ ok: boolean; total: number; count: number; tx: string }>('/api/payday', {});
  }
};
