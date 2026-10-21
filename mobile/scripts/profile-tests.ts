import assert from 'node:assert/strict';
import { createBetaProfileStore, normalizeBetaName, validateBetaProfile } from '../src/betaProfile';
import type { Storage } from '../src/sessionCore';

function fixture() {
  const values = new Map<string, string>();
  const storage: Storage = {
    get: async key => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); }
  };
  return { values, storage, store: createBetaProfileStore({ base: 'https://example.com', storage }) };
}

async function run() {
  let count = 0;
  const test = async (name: string, check: () => void | Promise<void>) => { await check(); console.log(`ok ${++count} - ${name}`); };
  await test('names preserve Unicode, combining marks, apostrophes and hyphens', () => {
    assert.equal(normalizeBetaName('  Oluwa  Tóbi  '), 'Oluwa Tóbi');
    assert.equal(normalizeBetaName('Jose\u0301'), 'José');
    assert.equal(normalizeBetaName('李小龍'), '李小龍');
    assert.equal(normalizeBetaName("Anne-Marie O’Neill"), 'Anne-Marie O’Neill');
  });
  await test('empty, hidden control, line break, and overlong names fail; boundary names succeed', () => {
    for (const name of ['', '  ', '123', 'A\nB', ' A\t ', 'A\u202eB', 'A\0B', 'x'.repeat(41)]) assert.throws(() => normalizeBetaName(name));
    assert.equal(normalizeBetaName('x'.repeat(40)).length, 40);
    assert.equal(normalizeBetaName('A'), 'A');
    assert.equal(normalizeBetaName('𐐀'.repeat(40)), '𐐀'.repeat(40));
  });
  await test('only demo IDs are accepted and extra role fields are discarded', () => {
    assert.deepEqual(validateBetaProfile({ name: 'Kenn', personId: 'sam', role: 'admin', token: 'untrusted' }), { name: 'Kenn', personId: 'sam' });
    for (const value of [null, [], 'Kenn', { name: 5, personId: 'sam' }, { name: 'Kenn', personId: 'owner' }, { name: 'Kenn', personId: '__proto__' }]) assert.throws(() => validateBetaProfile(value));
  });
  await test('profile keys are origin-scoped and distinct from session credentials', () => {
    const f = fixture();
    const other = createBetaProfileStore({ base: 'https://other.example.com', storage: f.storage });
    assert.notEqual(f.store.key, other.key);
    assert.ok(f.store.key.startsWith('teampot.beta.profile.'));
    assert.ok(!f.store.key.includes('session'));
  });
  await test('a fresh device has no profile and save returns only local identity', async () => {
    const f = fixture();
    assert.equal(await f.store.readFor('sam'), null);
    const saved = await f.store.save(' Kenn ', 'sam');
    assert.deepEqual(saved, { name: 'Kenn', personId: 'sam' });
    assert.deepEqual(await f.store.readFor('sam'), saved);
    assert.equal(f.values.size, 1);
  });
  await test('matching saved session restores personalization after a restart', async () => {
    const f = fixture();
    await f.store.save('Kenn', 'ava');
    const restarted = createBetaProfileStore({ base: 'https://example.com/', storage: f.storage });
    assert.deepEqual(await restarted.readFor('ava'), { name: 'Kenn', personId: 'ava' });
  });
  await test('no session or different verified persona discards old personalization', async () => {
    const f = fixture();
    await f.store.save('Kenn', 'sam');
    assert.equal(await f.store.readFor('jordan'), null);
    assert.equal(f.values.has(f.store.key), false);
    await f.store.save('Kenn', 'sam');
    assert.equal(await f.store.readFor(null), null);
    assert.equal(f.values.has(f.store.key), false);
  });
  await test('invalid local records cannot skip onboarding and are removed', async () => {
    const f = fixture();
    for (const raw of ['broken JSON', 'null', '{"name":"Kenn","personId":"owner"}', '{"name":"","personId":"sam"}']) {
      f.values.set(f.store.key, raw);
      assert.equal(await f.store.readFor('sam'), null);
      assert.equal(f.values.has(f.store.key), false);
    }
    // Positive control proves this is validation, not unconditional rejection.
    f.values.set(f.store.key, '{"name":"Kenn","personId":"sam"}');
    assert.equal((await f.store.readFor('sam'))?.name, 'Kenn');
  });
  await test('sign-out removes profile but never unrelated credentials or pending transactions', async () => {
    const f = fixture();
    f.values.set('session', 'credential'); f.values.set('pending', 'transaction');
    await f.store.save('Kenn', 'sam'); await f.store.clear();
    assert.equal(await f.store.readFor('sam'), null);
    assert.deepEqual([...f.values], [['session', 'credential'], ['pending', 'transaction']]);
  });
  await test('storage write failure is propagated, without a successful profile result', async () => {
    const f = fixture();
    f.storage.set = async () => { throw new Error('Secure storage unavailable'); };
    await assert.rejects(() => f.store.save('Kenn', 'sam'), /Secure storage unavailable/);
    assert.equal(await f.store.readFor('sam'), null);
    f.storage.get = async () => { throw new Error('Read unavailable'); };
    await assert.rejects(() => f.store.readFor('sam'), /Read unavailable/);
  });
  await test('late persistence cannot resurrect a signed-out profile', async () => {
    const f = fixture();
    let release!: () => void;
    f.storage.set = async (key, value) => { await new Promise<void>(resolve => { release = resolve; }); f.values.set(key, value); };
    const pending = f.store.save('Kenn', 'sam');
    const rejected = assert.rejects(pending, /cancelled/);
    await new Promise(resolve => setTimeout(resolve, 0));
    const clearing = f.store.clear();
    release(); await rejected; await clearing;
    assert.equal(await f.store.readFor('sam'), null);
  });
  await test('failed storage cleanup remains an error and a later clear can recover', async () => {
    const f = fixture(); await f.store.save('Kenn', 'sam');
    const remove = f.storage.remove;
    f.storage.remove = async () => { throw new Error('Cannot remove'); };
    await assert.rejects(() => f.store.clear(), /Cannot remove/);
    f.storage.remove = remove;
    await f.store.clear(); assert.equal(await f.store.readFor('sam'), null);
  });
  console.log(`BETA_PROFILE_TESTS_OK (${count} cases)`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
