// Passkey path end to end, with a headless WebAuthn key standing in for the device.
import { Account, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { http, parseUnits, pad, stringToHex } from 'viem'
import { P256, PublicKey, Signature, WebAuthnP256 } from 'ox'
const B = (process.env.BASE || 'http://localhost:8790') + '/api'
let cookie = ''
const post = async (p: string, b: any) => {
  const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(b) })
  const set = r.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0]
  return r.json()
}
const get = (p: string) => fetch(B + p, { headers: cookie ? { cookie } : {} }).then((r) => r.json())
await post('/auth/demo', { personId: 'jordan' })
const st0: any = await get('/state')
if (!st0.seeded) await post('/setup', {})
await post('/auth/demo', { personId: 'ava' })
const pk = P256.randomPrivateKey()
const pub = PublicKey.toHex(P256.getPublicKey({ privateKey: pk }))
console.log('enroll', await post('/passkey/enroll', { personId: 'ava', id: 'headless-ava', publicKey: pub }))
// A passkey assertion made for another website must be refused.
const evilCh: any = await post('/auth/challenge', { personId: 'ava' })
const evil = WebAuthnP256.getSignPayload({ challenge: evilCh.challenge, rpId: 'evil.example', origin: 'https://evil.example' })
const evilSig = P256.sign({ privateKey: pk, payload: evil.payload, hash: true })
const evilRes = await fetch(B + '/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json', cookie: (globalThis as any).__cookie ?? '' }, body: JSON.stringify({ personId: 'ava', challengeId: evilCh.id, metadata: evil.metadata, signature: Signature.toHex(evilSig) }) })
if (evilRes.status !== 401) throw new Error(`cross-site passkey assertion was not refused (${evilRes.status})`)
console.log('cross-site assertion refused', evilRes.status)
const challenge: any = await post('/auth/challenge', { personId: 'ava' })
const payload = WebAuthnP256.getSignPayload({ challenge: challenge.challenge, rpId: new URL(B).hostname, origin: new URL(B).origin })
const sig = P256.sign({ privateKey: pk, payload: payload.payload, hash: true })
console.log('signin', await post('/auth/verify', { personId: 'ava', challengeId: challenge.id, metadata: payload.metadata, signature: Signature.toHex(sig) }))
const authState: any = await get('/state')
if (authState.auth?.personId !== 'ava' || authState.auth?.demo) throw new Error('real passkey sign-in did not create an Ava session')
const blocked: any = await post('/pots/eng/return', { amount: 1, requestId: 'passkey-cross-dept' })
if (!String(blocked.error || '').match(/Only Finance|department head/)) throw new Error('Ava was not refused another department')
const info: any = await get('/passkey/pay-info/ava')
const acct = Account.fromHeadlessWebAuthn(pk, { access: info.company, rpId: 'localhost', origin: 'http://localhost:5280' } as any)
const chain: any = (tempoModerato as any).extend({ feeToken: info.token })
const k: any = createClient({ account: acct, chain, transport: http(), testnet: true } as any)
const st: any = await get('/state')
const vid = (n: string) => st.vendors.find((v: any) => v.name === n).id
const send = (vendorId: string, amt: number) => k.token.transferSync({ token: info.token, to: info.vendors[vendorId], amount: parseUnits(String(amt), 6), memo: pad(stringToHex('design:faceid'), { size: 32, dir: 'right' }) })
const ok = await send(vid('Adobe Fonts'), 29).then((r: any) => r.receipt.transactionHash)
console.log('record ok', JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Adobe Fonts'), amount: 29, note: 'Font license', tx: ok })).slice(0, 160))
const bad = await send(vid('Delta'), 300).then(() => 'UNEXPECTED', () => 'rejected')
console.log('off-list via device', bad, JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Delta'), amount: 300, note: 'Flight', rejected: true })).slice(0, 140))
console.log('forged record', JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Figma'), amount: 999, note: 'x', tx: '0x' + '1'.repeat(64) })).slice(0, 140))
await post('/auth/demo', { personId: 'jordan' })
const inv: any = await post('/invites', { name: 'Nina Park', role: 'employee', title: 'Design Researcher', team: 'design', salary: 3400 })
const ninaPk = P256.randomPrivateKey()
const ninaPub = PublicKey.toHex(P256.getPublicKey({ privateKey: ninaPk }))
console.log('invite accept', await post(`/invites/${inv.token}/accept`, { id: 'headless-nina', publicKey: ninaPub }))
const ninaState: any = await get('/state')
if (ninaState.auth?.personId !== 'nina-park' || ninaState.people[0]?.id !== 'nina-park') throw new Error('invite did not land Nina in her wallet')
const ninaInfo: any = await get('/passkey/pay-info/nina-park')
const ninaAcct = Account.fromHeadlessWebAuthn(ninaPk, { access: ninaInfo.company, rpId: 'localhost', origin: 'http://localhost:5280' } as any)
const nk: any = createClient({ account: ninaAcct, chain, transport: http(), testnet: true } as any)
const ninaTx = await nk.token.transferSync({ token: ninaInfo.token, to: ninaInfo.vendors[vid('Figma')], amount: parseUnits('11', 6), memo: pad(stringToHex('design:invite'), { size: 32, dir: 'right' }) }).then((r: any) => r.receipt.transactionHash)
console.log('invite spend', JSON.stringify(await post('/passkey/record', { personId: 'nina-park', vendorId: vid('Figma'), amount: 11, note: 'Research board', tx: ninaTx })).slice(0, 160))
const nina = (await get('/state')).people.find((p: any) => p.id === 'nina-park')
console.log('nina', nina.hasPasskey, nina.pot)
console.log('passkey e2e ok')
