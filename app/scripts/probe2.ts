// Probe 2: fee sponsorship (employee with $0 pays a vendor; company covers fees) + passkey-style P256 account.
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
const emp = Account.fromP256(generatePrivateKey()) // P256 = same curve as passkeys
const e = mk(emp)
await c.token.transferSync({ token: TOKEN, to: emp.address, amount: parseUnits('20', 6) })
const before = (await Actions.token.getBalance(c, { token: TOKEN, account: emp.address } as any)) as any
const r = await e.token.transferSync({ token: TOKEN, to: company.address, amount: parseUnits('5', 6), feePayer: company } as any)
  .then((x: any) => x.receipt.status, (err: any) => 'ERR ' + (err.shortMessage || err.message).slice(0, 160))
const after = (await Actions.token.getBalance(c, { token: TOKEN, account: emp.address } as any)) as any
console.log('sponsored transfer', r, 'employee before', JSON.stringify(before,(_,x)=>typeof x==='bigint'?x.toString():x), 'after', JSON.stringify(after,(_,x)=>typeof x==='bigint'?x.toString():x), '(exactly 5.000000 less = company paid fee)')
