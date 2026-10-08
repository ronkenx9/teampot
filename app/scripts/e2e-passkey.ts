// Passkey path end to end, with a headless WebAuthn key standing in for the device.
import { Account, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { http, parseUnits, pad, stringToHex } from 'viem'
import { P256, PublicKey } from 'ox'
const B = (process.env.BASE || 'http://localhost:8790') + '/api'
const post = (p: string, b: any) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json())
const pk = P256.randomPrivateKey()
const pub = PublicKey.toHex(P256.getPublicKey({ privateKey: pk }))
console.log('enroll', await post('/passkey/enroll', { personId: 'ava', id: 'headless-ava', publicKey: pub }))
const info: any = await fetch(B + '/passkey/pay-info/ava').then((r) => r.json())
const acct = Account.fromHeadlessWebAuthn(pk, { access: info.company, rpId: 'localhost', origin: 'http://localhost:5280' } as any)
const chain: any = (tempoModerato as any).extend({ feeToken: info.token })
const k: any = createClient({ account: acct, chain, transport: http(), testnet: true } as any)
const st: any = await fetch(B + '/state').then((r) => r.json())
const vid = (n: string) => st.vendors.find((v: any) => v.name === n).id
const send = (vendorId: string, amt: number) => k.token.transferSync({ token: info.token, to: info.vendors[vendorId], amount: parseUnits(String(amt), 6), memo: pad(stringToHex('design:faceid'), { size: 32, dir: 'right' }) })
const ok = await send(vid('Adobe Fonts'), 29).then((r: any) => r.receipt.transactionHash)
console.log('record ok', JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Adobe Fonts'), amount: 29, note: 'Font license', tx: ok })).slice(0, 160))
const bad = await send(vid('Delta'), 300).then(() => 'UNEXPECTED', () => 'rejected')
console.log('off-list via device', bad, JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Delta'), amount: 300, note: 'Flight', rejected: true })).slice(0, 140))
console.log('forged record', JSON.stringify(await post('/passkey/record', { personId: 'ava', vendorId: vid('Figma'), amount: 999, note: 'x', tx: '0x' + '1'.repeat(64) })).slice(0, 140))
const ava = (await fetch(B + '/state').then((r) => r.json())).people.find((p: any) => p.id === 'ava')
console.log('ava', ava.hasPasskey, ava.pot)
