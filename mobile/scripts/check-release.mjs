import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8'));

function profile(config, name, seen = new Set()) {
  assert(!seen.has(name), 'Build-profile inheritance must not cycle');
  seen.add(name);
  const own = config.build[name];
  assert(own, `Missing profile: ${name}`);
  const base = own.extends ? profile(config, own.extends, seen) : {};
  return { ...base, ...own, env: { ...base.env, ...own.env }, ios: { ...base.ios, ...own.ios } };
}

function validate(app, eas) {
  assert.equal(app.name, 'Teampot Beta');
  assert.equal(app.ios.bundleIdentifier, 'xyz.teampot.app');
  assert.equal(app.scheme, 'teampot');
  assert.match(app.version, /^\d+\.\d+\.\d+$/);
  assert.match(app.ios.buildNumber, /^\d+$/);
  assert.equal(app.ios.supportsTablet, false);
  assert.equal(app.orientation, 'portrait');
  assert.equal(app.userInterfaceStyle, 'automatic', 'Follow the phone appearance');
  assert.match(app.ios.infoPlist.NSFaceIDUsageDescription, /test payments/i);
  assert(!('ITSAppUsesNonExemptEncryption' in app.ios.infoPlist), 'Do not guess an encryption declaration');
  assert(!app.ios.appleTeamId && !app.owner && !app.extra?.eas?.projectId, 'Preparation must not invent project/signing identifiers; review any real linked configuration separately');
  const plugins = app.plugins.map(p => Array.isArray(p) ? p[0] : p);
  for (const name of ['expo-router', 'expo-secure-store', 'expo-font', 'expo-local-authentication']) assert(plugins.includes(name), `Missing native plugin: ${name}`);
  for (const path of [app.icon, app.splash.image, app.web.favicon]) assert(existsSync(resolve(root, path)), `Missing native asset: ${path}`);
  assert.equal(eas.cli.appVersionSource, 'remote');
  const simulator = profile(eas, 'simulator');
  const beta = profile(eas, 'beta');
  assert.equal(simulator.ios.simulator, true);
  assert.equal(simulator.distribution, 'internal');
  assert.equal(beta.distribution, 'store', 'TestFlight requires store distribution');
  assert(!beta.ios.simulator, 'TestFlight must target real iOS devices');
  assert.equal(beta.autoIncrement, true);
  for (const p of [simulator, beta]) {
    assert(!p.developmentClient, 'Profiles are standalone builds, not dev clients');
    assert.equal(p.env.EXPO_PUBLIC_API_BASE, 'https://teampot.vercel.app');
    assert.deepEqual(Object.keys(p.env), ['EXPO_PUBLIC_API_BASE'], 'Only the public API URL belongs in bundled environment values');
  }
  assert.deepEqual(eas.submit, { beta: {} }, 'Preparation does not invent submission credentials');
}

validate(app, eas);
// Positive baseline plus negative controls: this checker must reject plausible
// release mistakes, not only accept today's fixture.
for (const breakConfig of [
  c => { c.build.beta.distribution = 'internal'; },
  c => { c.build.simulator.ios.simulator = false; },
  c => { c.build.beta.ios = { simulator: true }; },
  c => { c.build.base.env.PRIVATE_KEY = 'must-not-be-bundled'; },
  c => { c.build.base.env.EXPO_PUBLIC_API_BASE = 'http://example.invalid'; },
  c => { c.build.base.extends = 'beta'; },
]) {
  const broken = structuredClone(eas);
  breakConfig(broken);
  assert.throws(() => validate(app, broken));
}
const invented = structuredClone(app);
invented.ios.appleTeamId = 'EXAMPLETEAM';
assert.throws(() => validate(invented, eas));
console.log('BETA_RELEASE_CONFIG_OK');
