// Creates and closes a shared testnet demo session. Never calls a payment or write endpoint beyond auth.
import { writeFileSync } from 'node:fs';
import { createBetaClient } from '../src/sessionCore.ts';
const values = new Map<string,string>();
const client = createBetaClient({base:'https://teampot.vercel.app',native:true,storage:{async get(k){return values.get(k)??null},async set(k,v){values.set(k,v)},async remove(k){values.delete(k)}}});
async function run() {
try {
  const state = await client.login('sam');
  const restored = await client.restore();
  if (!restored || restored.auth?.personId !== 'sam') throw new Error('Session restoration failed');
  writeFileSync('../work/ios-beta/api-results.json',JSON.stringify({checkedAt:new Date().toISOString(),api:client.base,network:state.earn?.network||state.company.network,role:state.auth?.role,nativeCookieTransport:true,restored:true,financialActions:0,note:'Node transport check, not a device SecureStore/Face ID test.'},null,2)+'\n');
  console.log('IOS_BETA_API_OK');
} finally { await client.logout(); }

}
run().catch(error => { console.error(error instanceof Error ? error.message : 'API verification failed'); process.exitCode = 1; });
