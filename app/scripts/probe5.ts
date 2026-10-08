// Passkey-type (webAuthn) access key: authorize by public key only, then spend with WebAuthn signatures.
import * as T from '../server/tempo.ts'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { http } from 'viem'
import { P256 } from 'ox'
const chain: any = (tempoModerato as any).extend({ feeToken: T.TOKEN })
const pk = P256.randomPrivateKey()
const publicKey = P256.getPublicKey({ privateKey: pk })
const vendor = T.newAddress()
const { PublicKey } = await import('ox')
const r = await Actions.accessKey.authorizeSync(T.company, { accessKey: { publicKey: PublicKey.toHex(publicKey), type: 'webAuthn' }, expiry: Math.floor(Date.now() / 1000) + 3600,
  limits: [{ token: T.TOKEN, limit: T.usd(50), period: 3600 }],
  scopes: [{ address: T.TOKEN, selector: 'transferWithMemo(address,uint256,bytes32)', recipients: [vendor] }] } as any)
console.log('authorize by public key', (r.receipt ?? r).status)
const acct = Account.fromHeadlessWebAuthn(pk, { access: T.companyAccount, rpId: 'localhost', origin: 'http://localhost:5280' } as any)
const k: any = createClient({ account: acct, chain, transport: http(), testnet: true } as any)
const x = await k.token.transferSync({ token: T.TOKEN, to: vendor, amount: T.usd(5), memo: T.memo('design:passkey') }).then((y: any) => 'ok ' + y.receipt.transactionHash, (e: any) => 'ERR ' + (e.shortMessage || e.message).split('\n')[0])
console.log('webAuthn-signed spend', x)
