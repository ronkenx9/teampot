import 'dotenv/config'
import { http, parseUnits, formatUnits, pad, stringToHex, keccak256, concat, toHex } from 'viem'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'

const TOKEN = '0x20c0000000000000000000000000000000000000' as const
const chain: any = (tempoModerato as any).extend({ feeToken: TOKEN })
const mk = (account: any) => createClient({ account, chain, transport: http(), testnet: true } as any) as any
const usd = (n: number | string) => parseUnits(String(n), 6)
const fmt = (v: bigint) => Number(formatUnits(v, 6))
const memo = (s: string) => pad(stringToHex(s.slice(0, 31)), { size: 32, dir: 'right' })

const secret = process.env.OPERATOR_PK as `0x${string}` | undefined
if (!secret) throw new Error('OPERATOR_PK is required')

const derive = (label: string) => keccak256(concat([secret, toHex(`teampot:v3-probe:${label}`)])) as `0x${string}`
const companyAccount = Account.fromSecp256k1(secret)
const company = mk(companyAccount)
const departmentRoot = Account.fromP256(derive(`dept-root:${Date.now()}`))
const memberKey = Account.fromP256(derive(`member-key:${Date.now()}`), { access: departmentRoot } as any)
const approvedVendor = Account.fromP256(derive(`vendor-approved:${Date.now()}`))
const offListVendor = Account.fromP256(derive(`vendor-off-list:${Date.now()}`))

async function balance(address: string) {
  const b: any = await Actions.token.getBalance(company, { token: TOKEN, account: address } as any)
  return Number(b.formatted ?? fmt(BigInt(b.amount ?? b)))
}

async function main() {
  const dept = mk(departmentRoot)
  const member = mk(memberKey)
  const out: Record<string, unknown> = {
    company: companyAccount.address,
    department: departmentRoot.address,
    memberKey: memberKey.address,
    approvedVendor: approvedVendor.address,
    offListVendor: offListVendor.address,
  }

  const fund = await company.token.transferSync({
    token: TOKEN,
    to: departmentRoot.address,
    amount: usd(12),
    memo: memo('dept funding probe'),
  } as any)
  out.fundTx = fund.receipt.transactionHash
  out.deptBalanceAfterFund = await balance(departmentRoot.address)

  const auth = await Actions.accessKey.authorizeSync(dept, {
    accessKey: memberKey,
    expiry: Math.floor(Date.now() / 1000) + 7 * 86400,
    limits: [{ token: TOKEN, limit: usd(5), period: 86400 }],
    scopes: ['transfer(address,uint256)', 'transferWithMemo(address,uint256,bytes32)'].map((selector) => ({
      address: TOKEN,
      selector,
      recipients: [approvedVendor.address],
    })),
  } as any)
  out.authorizeTx = (auth.receipt ?? auth).transactionHash

  const ok = await member.token.transferSync({
    token: TOKEN,
    to: approvedVendor.address,
    amount: usd(1.25),
    memo: memo('dept member ok'),
  } as any)
  out.memberSpendTx = ok.receipt.transactionHash
  out.deptBalanceAfterSpend = await balance(departmentRoot.address)

  try {
    await member.token.transferSync({
      token: TOKEN,
      to: offListVendor.address,
      amount: usd(1),
      memo: memo('dept member denied'),
    } as any)
    out.offListRejected = false
  } catch (e: any) {
    out.offListRejected = true
    out.offListReason = String(e.shortMessage || e.message).split('\n')[0]
  }

  const ret = await dept.token.transferSync({
    token: TOKEN,
    to: companyAccount.address,
    amount: usd(2),
    memo: memo('dept return probe'),
  } as any)
  out.returnTx = ret.receipt.transactionHash
  out.deptBalanceAfterReturn = await balance(departmentRoot.address)

  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(String(e.shortMessage || e.message || e))
  process.exit(1)
})
