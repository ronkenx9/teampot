import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api, ApiError } from './api';
import { createFlightGuard } from './sessionCore';
import { createBetaProfileStore, validateBetaProfile, type BetaProfile } from './betaProfile';
import type { State, StockId } from './types';

type Toast = { tone: 'good' | 'warn' | 'bad'; title: string; detail?: string } | null;
type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';
type TeampotContext = {
  state: State | null; loading: boolean; toast: Toast; personId: string;
  sessionStatus: SessionStatus; error: string | null; betaProfile: BetaProfile | null;
  completeOnboarding: (name: string, personId: string) => Promise<boolean>;
  refresh: () => Promise<void>; demoLogin: (personId: string) => Promise<void>; signOut: () => Promise<void>;
  payVendor: (vendorId: string, amount: number, note: string) => Promise<void>;
  decideHeld: (id: string, action: 'approve' | 'approve-add' | 'return') => Promise<void>;
  saveElection: (stockId: StockId, percent: number) => Promise<void>;
  tradeStock: (stockId: StockId, side: 'buy' | 'sell', options: { cashAmount?: number; shares?: number }) => Promise<void>;
  sendInvoice: (amount: number, description: string) => Promise<void>; runPayday: () => Promise<void>; clearToast: () => void;
};
const profileStore = createBetaProfileStore({
  base: api.base,
  storage: {
    async get(key) { return Platform.OS === 'web' ? (typeof window === 'undefined' ? null : window.localStorage.getItem(key)) : SecureStore.getItemAsync(key); },
    async set(key, value) { if (Platform.OS === 'web') window.localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
    async remove(key) { if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } else await SecureStore.deleteItemAsync(key); }
  }
});
const Context = createContext<TeampotContext | null>(null);
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';
const positive = (value: number) => Number.isFinite(value) && value > 0;
const feedback = async () => { if (Platform.OS !== 'web') await Haptics.selectionAsync().catch(() => {}); };

export function TeampotProvider({ children }: PropsWithChildren) {
  const [personId, setPersonId] = useState('');
  const [betaProfile, setBetaProfile] = useState<BetaProfile | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('restoring');
  const epoch = useRef(0);
  const flight = useRef(createFlightGuard());
  const showFailure = useCallback((cause: unknown, title: string) => {
    setError(message(cause)); setToast({ tone: 'bad', title, detail: message(cause) });
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403 && cause.message.startsWith('This beta only'))) { setState(null); setPersonId(''); setBetaProfile(null); setSessionStatus('signedOut'); void profileStore.clear().catch(() => {}); }
  }, []);
  const restore = useCallback(async (current: number) => {
    try {
      const next = await api.restore();
      if (current !== epoch.current) return;
      const profile = await profileStore.readFor(next?.auth?.personId || null);
      if (current !== epoch.current) return;
      setBetaProfile(profile); setState(next); setPersonId(next?.auth?.personId || ''); setSessionStatus(next ? 'signedIn' : 'signedOut'); setError(null);
    } catch (cause) {
      const saved = await api.session().catch(() => null);
      if (current !== epoch.current) return;
      const profile = await profileStore.readFor(saved?.personId || null).catch(() => null);
      if (current !== epoch.current) return;
      setBetaProfile(profile); setState(null); setPersonId(saved?.personId || ''); setSessionStatus(saved ? 'signedIn' : 'signedOut');
      showFailure(cause, 'Unable to load your beta session');
    }
  }, [showFailure]);
  useEffect(() => {
    const current = ++epoch.current;
    void restore(current).finally(() => { if (current === epoch.current) setLoading(false); });
    return () => { ++epoch.current; };
  }, [restore]);
  const refresh = useCallback(async () => {
    if (!flight.current.acquire()) return;
    const current = epoch.current; setLoading(true);
    try { await restore(current); } finally { flight.current.release(); if (current === epoch.current) setLoading(false); }
  }, [restore]);
  const login = useCallback(async (id: string, name?: string): Promise<boolean> => {
    if (!flight.current.acquire()) return false;
    const current = ++epoch.current;
    setLoading(true); setState(null); setBetaProfile(null); setSessionStatus('signedOut'); setToast(null); setError(null);
    try {
      // Validate before contacting the service; only the selected demo ID is sent.
      const draft = name === undefined ? null : validateBetaProfile({ name, personId: id });
      await profileStore.clear();
      if (current !== epoch.current) return false;
      const result = await api.demo(id);
      if (current !== epoch.current) return false;
      const profile = draft ? await profileStore.save(draft.name, result.personId) : null;
      if (current !== epoch.current) return false;
      setBetaProfile(profile); setPersonId(result.personId); setState(result.state); setSessionStatus('signedIn'); await feedback();
      return current === epoch.current;
    } catch (cause) {
      if (current !== epoch.current) return false;
      // A name that could not be saved must not leave a usable beta session.
      await Promise.allSettled([api.clearSession(), profileStore.clear()]);
      if (current !== epoch.current) return false;
      setBetaProfile(null); setSessionStatus('signedOut'); setPersonId(''); showFailure(cause, 'Could not open the beta');
      return false;
    } finally { flight.current.release(); if (current === epoch.current) setLoading(false); }
  }, [showFailure]);
  const demoLogin = useCallback(async (id: string) => { await login(id); }, [login]);
  const completeOnboarding = useCallback((name: string, id: string) => login(id, name), [login]);
  const signOut = useCallback(async () => {
    ++epoch.current; setState(null); setPersonId(''); setBetaProfile(null); setSessionStatus('signedOut'); setToast(null); setError(null); setLoading(true);
    const current = epoch.current;
    try {
      const results = await Promise.allSettled([api.signOut(), profileStore.clear()]);
      if (results.some(result => result.status === 'rejected')) throw new Error('Local sign-out failed.');
    } catch { if (current === epoch.current) setError('Could not clear saved beta data. Close and reopen Teampot before signing in.'); }
    finally { if (current === epoch.current) setLoading(false); }
  }, []);
  const execute = useCallback(async (title: string, action: () => Promise<NonNullable<Toast>>) => {
    if (!flight.current.acquire()) return;
    const current = epoch.current; setLoading(true); setError(null); setToast(null);
    try {
      if (!state || !personId || !betaProfile || betaProfile.personId !== personId || sessionStatus !== 'signedIn') throw new ApiError('Refresh your beta session before continuing.', 401);
      const result = await action();
      if (current !== epoch.current) return;
      // A committed action stays a success even if refreshing its receipt fails.
      await restore(current);
      if (current !== epoch.current) return;
      setToast(result); await feedback();
    } catch (cause) { if (current === epoch.current) showFailure(cause, title); }
    finally { flight.current.release(); if (current === epoch.current) setLoading(false); }
  }, [betaProfile, personId, restore, sessionStatus, showFailure, state]);
  const payVendor = useCallback((vendorId: string, amount: number, note: string) => execute('Payment not completed', async () => {
    if (!positive(amount) || !state?.vendors.some(v => v.id === vendorId)) throw new ApiError('Choose a vendor and enter a positive amount.', 400);
    const result = await api.spend({ personId, vendorId, amount, note: note.trim() });
    return result.ok ? { tone: 'good', title: 'Test payment sent', detail: 'The receipt is in recent activity.' } : { tone: 'warn', title: 'Held for approval', detail: result.reason || result.held?.note };
  }), [execute, personId, state]);
  const decideHeld = useCallback((id: string, action: 'approve' | 'approve-add' | 'return') => execute('Decision not completed', async () => {
    if (!['admin', 'lead'].includes(state?.auth?.role || '')) throw new ApiError('This profile cannot review requests.', 403);
    await api.decide(id, action, personId); return { tone: 'good', title: action === 'return' ? 'Returned' : 'Approved', detail: 'Decision recorded.' };
  }), [execute, personId, state]);
  const saveElection = useCallback((stockId: StockId, percent: number) => execute('Election not saved', async () => {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new ApiError('Choose a percentage between 0 and 100.', 400);
    await api.election({ personId, stockId, percent });
    return { tone: 'good', title: 'Pay-to-stocks saved', detail: percent > 0 ? `${percent}% of payday will buy test shares.` : 'Pay-to-stocks is off.' };
  }), [execute, personId]);
  const tradeStock = useCallback((stockId: StockId, side: 'buy' | 'sell', options: { cashAmount?: number; shares?: number }) => execute('Trade not completed', async () => {
    if (!positive(side === 'buy' ? options.cashAmount || 0 : options.shares || 0)) throw new ApiError('Enter a positive trade amount.', 400);
    const result = await api.trade({ personId, stockId, side, ...options });
    return { tone: 'good', title: side === 'buy' ? 'Bought test shares' : 'Sold test shares', detail: `${result.shares} shares at ${result.stock}.` };
  }), [execute, personId]);
  const sendInvoice = useCallback((amount: number, description: string) => execute('Invoice not sent', async () => {
    if (state?.auth?.role !== 'contractor') throw new ApiError('Use the contractor profile to submit an invoice.', 403);
    if (!positive(amount) || !description.trim()) throw new ApiError('Enter a positive amount and a description.', 400);
    await api.invoice({ contractorId: personId, amount, description: description.trim() });
    return { tone: 'good', title: 'Invoice sent', detail: 'Finance and your department head can review it.' };
  }), [execute, personId, state]);
  const runPayday = useCallback(() => execute('Payday not completed', async () => {
    if (state?.auth?.role !== 'admin') throw new ApiError('Only Finance can run payday.', 403);
    const result = await api.payday(); return { tone: 'good', title: 'Test payday sent', detail: `${result.count} people paid.` };
  }), [execute, state]);
  const value = useMemo(() => ({ state, loading, toast, personId, sessionStatus, error, betaProfile, completeOnboarding, refresh, demoLogin, signOut, payVendor, decideHeld, saveElection, tradeStock, sendInvoice, runPayday, clearToast: () => setToast(null) }), [state, loading, toast, personId, sessionStatus, error, betaProfile, completeOnboarding, refresh, demoLogin, signOut, payVendor, decideHeld, saveElection, tradeStock, sendInvoice, runPayday]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTeampot() { const context = useContext(Context); if (!context) throw new Error('useTeampot must be used inside TeampotProvider'); return context; }
