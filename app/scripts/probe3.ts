// Probe 3: team-pot key locked to approved vendors (scope recipients) + periodic cap.
import 'dotenv/config'
import { http, parseUnits } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
const TOKEN = '0x20c0000000000000000000000000000000000000'
const chain: any = (tempoModerato as any).extend({ feeToken: TOKEN })
const mk = (account: any) => createClient({ account, chain, transport: http(), testnet: true } as any) as any
const company = Account.fromSecp256k1(process.env.OPERATOR_PK as `0x${string}`)
const c = mk(company)
const approved = Account.fromSecp256k1(generatePrivateKey()).address
const stranger = Account.fromSecp256k1(generatePrivateKey()).address
const key = Account.fromP256(generatePrivateKey(), { access: company } as any)
const r = await Actions.accessKey.authorizeSync(c, {
  accessKey: key, expiry: Math.floor(Date.now() / 1000) + 86400,
  limits: [{ token: TOKEN, limit: parseUnits('100', 6), period: 3600 }],
  scopes: [
    { address: TOKEN, selector: 'transfer(address,uint256)', recipients: [approved] },
    { address: TOKEN, selector: 'transferWithMemo(address,uint256,bytes32)', recipients: [approved] },
  ],
} as any).then((x: any) => x.receipt?.status, (e: any) => 'ERR ' + (e.shortMessage || e.message).slice(0, 200))
console.log('authorize scoped key', r)
const k = mk(key)
const pay = (to: string) => k.token.transferSync({ token: TOKEN, to, amount: parseUnits('10', 6) }).then((x: any) => 'ok ' + x.receipt.status, (e: any) => 'blocked ' + (e.shortMessage || e.message).split('\n')[0].slice(0, 120))
console.log('pay approved vendor', await pay(approved))
console.log('pay unapproved vendor', await pay(stranger))
