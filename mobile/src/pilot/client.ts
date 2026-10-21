import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createPilotClient } from './clientCore';

// An idempotency identifier is not an authentication secret. Its random component
// plus timestamp makes independently started requests distinct on Expo Go too.
export function requestUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const now = Date.now().toString(16).padStart(12, '0').slice(-12);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); }) + now;
}
export const pilotClient = createPilotClient({
  base: process.env.EXPO_PUBLIC_API_BASE || 'https://teampot.vercel.app', uuid: requestUUID,
  storage: {
    async get(key) { return Platform.OS === 'web' ? (typeof window === 'undefined' ? null : window.localStorage.getItem(key)) : SecureStore.getItemAsync(key); },
    async set(key, value) { if (Platform.OS === 'web') window.localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
    async remove(key) { if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } else await SecureStore.deleteItemAsync(key); }
  }
});
