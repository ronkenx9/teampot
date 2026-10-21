import { betaApiBase, type Storage } from './sessionCore';

/** Personalization on this device, never an account or a permission grant. */
export type BetaProfile = { name: string; personId: string };
const demoIds = new Set(['sam', 'ava', 'mateo', 'jordan']);

export function normalizeBetaName(input: string): string {
  if (typeof input !== 'string' || /[\p{Cc}\p{Cf}]/u.test(input)) throw new Error('Use your name without line breaks or hidden characters.');
  const name = input.normalize('NFC').trim().replace(/ {2,}/g, ' ');
  if (!name || !/\p{L}/u.test(name)) throw new Error('Enter the name you’d like us to use.');
  if ([...name].length > 40) throw new Error('Keep your name to 40 characters or fewer.');
  return name;
}

export function validateBetaProfile(value: unknown): BetaProfile {
  if (!value || typeof value !== 'object') throw new Error('Your beta profile needs to be set up again.');
  const record = value as Partial<BetaProfile>;
  if (typeof record.name !== 'string' || typeof record.personId !== 'string' || !demoIds.has(record.personId)) throw new Error('Choose one of the available beta roles.');
  return { name: normalizeBetaName(record.name), personId: record.personId };
}

export function createBetaProfileStore({ base, storage }: { base: string; storage: Storage }) {
  const key = `teampot.beta.profile.${encodeURIComponent(betaApiBase(base)).replace(/%/g, '_')}`;
  let revision = 0;
  let queue = Promise.resolve();
  function serialized<T>(job: () => Promise<T>): Promise<T> {
    const next = queue.then(job, job);
    queue = next.then(() => {}, () => {});
    return next;
  }
  async function readFor(personId: string | null): Promise<BetaProfile | null> {
    return serialized(async () => {
      const raw = await storage.get(key);
      if (!raw) return null;
      let profile: BetaProfile | null = null;
      try { profile = validateBetaProfile(JSON.parse(raw)); } catch { /* Invalid local data must never skip setup. */ }
      if (!profile || profile.personId !== personId) {
        await storage.remove(key);
        return null;
      }
      return profile;
    });
  }
  async function save(name: string, personId: string): Promise<BetaProfile> {
    const profile = validateBetaProfile({ name, personId });
    const current = revision;
    return serialized(async () => {
      if (current !== revision) throw new Error('Beta setup was cancelled.');
      await storage.set(key, JSON.stringify(profile));
      if (current !== revision) throw new Error('Beta setup was cancelled.');
      return profile;
    });
  }
  async function clear() {
    ++revision;
    await serialized(() => storage.remove(key));
  }
  return { key, readFor, save, clear };
}
