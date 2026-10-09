import * as Haptics from 'expo-haptics';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { api, readPerson, withPersona } from './api';
import type { State, StockId } from './types';

type Toast = { tone: 'good' | 'warn' | 'bad'; title: string; detail?: string } | null;

type TeampotContext = {
  state: State | null;
  loading: boolean;
  toast: Toast;
  personId: string;
  refresh: () => Promise<void>;
  demoLogin: (personId: string) => Promise<void>;
  payVendor: (vendorId: string, amount: number, note: string) => Promise<void>;
  decideHeld: (id: string, action: 'approve' | 'approve-add' | 'return') => Promise<void>;
  saveElection: (stockId: StockId, percent: number) => Promise<void>;
  tradeStock: (stockId: StockId, side: 'buy' | 'sell', options: { cashAmount?: number; shares?: number }) => Promise<void>;
  sendInvoice: (amount: number, description: string) => Promise<void>;
  runPayday: () => Promise<void>;
  clearToast: () => void;
};

const Context = createContext<TeampotContext | null>(null);

export function TeampotProvider({ children }: PropsWithChildren) {
  const [personId, setPersonId] = useState('sam');
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  const refreshFor = useCallback(async (id: string) => {
    try {
      const next = await api.state();
      setState(withPersona(next, id));
      return true;
    } catch {
      setState(null);
      setToast({ tone: 'bad', title: "Can't reach Teampot", detail: 'Check the API connection and retry.' });
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await refreshFor(personId);
    setLoading(false);
  }, [personId, refreshFor]);

  const demoLogin = useCallback(async (id: string) => {
    setLoading(true);
    setPersonId(id);
    setState(null);
    try {
      await api.demo(id);
      await refreshFor(id);
      if (Platform.OS !== 'web') await Haptics.selectionAsync();
    } catch {
      setState(null);
      setToast({ tone: 'bad', title: "Can't reach Teampot", detail: 'Retry when the live API is reachable from this runtime.' });
    } finally {
      setLoading(false);
    }
  }, [refreshFor]);

  useEffect(() => {
    let cancelled = false;
    readPerson().then(async (saved) => {
      if (cancelled) return;
      await demoLogin(saved || 'sam');
    });
    return () => { cancelled = true; };
  }, [demoLogin]);

  const payVendor = useCallback(async (vendorId: string, amount: number, note: string) => {
    const actor = state?.people.find((p) => p.id === personId);
    if (!actor) return;
    setLoading(true);
    try {
      const res = await api.spend({ personId: actor.id, vendorId, amount, note });
      await refreshFor(actor.id);
      setToast(res.ok
        ? { tone: 'good', title: 'Paid', detail: 'Receipt is in recent activity.' }
        : { tone: 'warn', title: 'Held for approval', detail: res.reason || res.held?.note });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(res.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      setToast({ tone: 'bad', title: 'Payment failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [personId, refreshFor, state]);

  const decideHeld = useCallback(async (id: string, action: 'approve' | 'approve-add' | 'return') => {
    setLoading(true);
    try {
      await api.decide(id, action, personId);
      await refresh();
      setToast({ tone: 'good', title: action === 'return' ? 'Returned' : 'Approved', detail: 'Decision recorded.' });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ tone: 'bad', title: 'Decision failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [personId, refresh]);

  const saveElection = useCallback(async (stockId: StockId, percent: number) => {
    const actor = state?.people.find((p) => p.id === personId);
    if (!actor) return;
    setLoading(true);
    try {
      await api.election({ personId: actor.id, stockId, percent });
      await refreshFor(actor.id);
      setToast({ tone: 'good', title: 'Pay-to-stocks saved', detail: percent > 0 ? `${percent}% of payday will buy test shares.` : 'Pay-to-stocks is off.' });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ tone: 'bad', title: 'Election failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [personId, refreshFor, state]);

  const tradeStock = useCallback(async (stockId: StockId, side: 'buy' | 'sell', options: { cashAmount?: number; shares?: number }) => {
    const actor = state?.people.find((p) => p.id === personId);
    if (!actor) return;
    setLoading(true);
    try {
      const res = await api.trade({ personId: actor.id, stockId, side, ...options });
      await refreshFor(actor.id);
      setToast({ tone: 'good', title: side === 'buy' ? 'Bought test shares' : 'Sold test shares', detail: `${res.shares} shares at ${res.stock}.` });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ tone: 'bad', title: side === 'buy' ? 'Buy failed' : 'Sell failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [personId, refreshFor, state]);

  const sendInvoice = useCallback(async (amount: number, description: string) => {
    setLoading(true);
    try {
      await api.invoice({ contractorId: personId, amount, description });
      await refresh();
      setToast({ tone: 'good', title: 'Invoice sent', detail: 'Finance and the department head can review it.' });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ tone: 'bad', title: 'Invoice failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [personId, refresh]);

  const runPayday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.payday();
      await refresh();
      setToast({ tone: 'good', title: 'Payday ran', detail: `${res.count} people paid.` });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ tone: 'bad', title: 'Payday failed', detail: error instanceof Error ? error.message : "Can't reach Teampot." });
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const value = useMemo(() => ({
    state,
    loading,
    toast,
    personId,
    refresh,
    demoLogin,
    payVendor,
    decideHeld,
    saveElection,
    tradeStock,
    sendInvoice,
    runPayday,
    clearToast: () => setToast(null)
  }), [state, loading, toast, personId, refresh, demoLogin, payVendor, decideHeld, saveElection, tradeStock, sendInvoice, runPayday]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTeampot() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useTeampot must be used inside TeampotProvider');
  return ctx;
}
