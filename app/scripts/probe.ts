// Day-1 probe: which Tempo primitives Teampot needs actually work on Moderato (chain 42431).
import 'dotenv/config'
import { http, parseUnits, stringToHex, pad } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'

const TOKEN = '0x20c0000000000000000000000000000000000000' // pathUSD, 6 dp
const chain: any = (tempoModerato as any).extend({ feeToken: TOKEN })
const usd = (n: string) => parseUnits(n, 6)
const memo = (s: string) => pad(stringToHex(s), { size: 32, dir: 'right' })
const mk = (account: any) => createClient({ account, chain, transport: http(), testnet: true } as any) as any
const log = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${typeof v === 'string' ? v : JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x))}`)

const company = Account.fromSecp256k1(process.env.OPERATOR_PK as `0x${string}`)
const c = mk(company)
const bal = async (a: string) => (await Actions.token.getBalance(c, { token: TOKEN, account: a } as any)) as bigint

async function main() {
  log('company', company.address)
  log('company balance', String(await bal(company.address)))

  // 1. Payday: one atomic batch paying 5 people, each transfer carries a memo.
  const staff = Array.from({ length: 5 }, () => Account.fromSecp256k1(generatePrivateKey()).address)
  const calls = staff.map((to, i) => Actions.token.transfer.call({ token: TOKEN, to, amount: usd(String(100 + i)), memo: memo(`payday-2026-10-${i}`) } as any))
  const t0 = Date.now()
  const r1 = await c.sendTransactionSync({ calls })
  log('1 payday batch', { status: r1.status, tx: r1.transactionHash, ms: Date.now() - t0, recipients: staff.length })
  log('  staff[4] balance', String(await bal(staff[4])))

  // 2. Team pot: access key with a periodic limit (100 per hour) on the company account.
  const potKey = Account.fromP256(generatePrivateKey(), { access: company } as any)
  const r2 = await Actions.accessKey.authorizeSync(c, { accessKey: potKey, expiry: Math.floor(Date.now() / 1000) + 86400, limits: [{ token: TOKEN, limit: usd('100'), period: 3600 }] } as any)
  log('2 pot key authorized', { status: r2.receipt?.status ?? r2.status })
  const pot = mk(potKey)
  const vendor = Account.fromSecp256k1(generatePrivateKey()).address
  const ok = await pot.token.transferSync({ token: TOKEN, to: vendor, amount: usd('60'), memo: memo('design:font-license') }).then((x: any) => x.receipt.status, (e: any) => 'ERR ' + e.shortMessage)
  log('  spend 60 within cap', ok)
  const over = await pot.token.transferSync({ token: TOKEN, to: vendor, amount: usd('50') }).then((x: any) => 'UNEXPECTED ' + x.receipt.status, (e: any) => 'blocked: ' + (e.shortMessage || e.message).slice(0, 120))
  log('  spend 50 over cap', over)
  log('  remaining', await Actions.accessKey.getRemainingLimit(c, { accessKey: potKey, token: TOKEN } as any))

  // 3. Sub-delegation: can the pot key authorize a further key (lead -> employee)?
  const empKey = Account.fromP256(generatePrivateKey(), { access: company } as any)
  const sub = await Actions.accessKey.authorizeSync(pot, { accessKey: empKey, expiry: Math.floor(Date.now() / 1000) + 3600, limits: [{ token: TOKEN, limit: usd('10'), period: 3600 }] } as any)
    .then((x: any) => 'UNEXPECTED ok ' + (x.receipt?.status ?? ''), (e: any) => 'not allowed: ' + (e.shortMessage || e.message).slice(0, 120))
  log('3 sub-delegate key', sub)

  // 4. Fee sponsorship sanity: fresh account with zero balance sending with company as fee payer is tested in UI phase.
}
main().catch((e) => { console.error('FATAL', e.shortMessage || e.message); process.exit(1) })
