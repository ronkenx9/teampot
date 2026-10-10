// Probe: can a department head hold an admin access key (TIP-1049) on the department account
// and use it to issue a capped, vendor-scoped member card? Run: npx tsx scripts/probe-admin-key.ts
import 'dotenv/config'
import { generatePrivateKey } from 'viem/accounts'
import { Account, Actions } from 'viem/tempo'
import * as T from '../server/tempo.js'

const dept = Account.fromP256(generatePrivateKey())             // department account root (held by Finance)
const headPk = generatePrivateKey()
const head = Account.fromP256(headPk, { access: dept } as any)   // head's key acting as the department
const memberPk = generatePrivateKey()
const member = Account.fromP256(memberPk, { access: dept } as any)
const vendor = Account.fromSecp256k1(generatePrivateKey()).address
const other = Account.fromSecp256k1(generatePrivateKey()).address
const step = async (name: string, fn: () => Promise<any>) => {
  try { const r = await fn(); console.log('OK  ', name, typeof r === 'string' ? r : JSON.stringify(r, (_k, v) => typeof v === 'bigint' ? v.toString() : v)?.slice(0, 160)); return r }
  catch (e: any) { console.log('FAIL', name, String(e.shortMessage || e.message).split('\n').slice(0, 3).join(' | ')); return null }
}
console.log('dept', dept.address)
await step('fund dept $50', () => T.companyPay(dept.address, 50, T.memo('probe fund')))
await step('dept authorizes head as ADMIN key', async () => (await Actions.accessKey.authorizeSync(T.clientFor(dept), { accessKey: head, admin: true } as any)).receipt.transactionHash)
await step('head (admin key) authorizes member: $10/mo, vendor-only', async () => (await Actions.accessKey.authorizeSync(T.clientFor(head), {
  accessKey: member, expiry: Math.floor(Date.now() / 1000) + 86400 * 30,
  limits: [{ token: T.TOKEN, limit: T.usd(10), period: 2592000 }],
  scopes: ['transfer(address,uint256)', 'transferWithMemo(address,uint256,bytes32)'].map((selector) => ({ address: T.TOKEN, selector, recipients: [vendor] })),
} as any)).receipt.transactionHash)
await step('member remaining limit', () => T.remainingOn(dept, { pk: memberPk }))
await step('member pays vendor $4 (expect OK)', () => T.spendWithKeyOn(dept, { pk: memberPk }, vendor, 4, 'probe'))
await step('member pays vendor $8 (over cap, expect FAIL)', () => T.spendWithKeyOn(dept, { pk: memberPk }, vendor, 8, 'probe'))
await step('member pays unlisted $1 (expect FAIL)', () => T.spendWithKeyOn(dept, { pk: memberPk }, other, 1, 'probe'))
await step('head pays unlisted $3 (approval, expect OK)', () => T.spendWithKeyOn(dept, { pk: headPk }, other, 3, 'probe approve'))
await step('head revokes member', async () => (await Actions.accessKey.revokeSync(T.clientFor(head), { accessKey: member } as any)).receipt.transactionHash)
await step('member pays after revoke (expect FAIL)', () => T.spendWithKeyOn(dept, { pk: memberPk }, vendor, 1, 'probe'))
await step('dept root revokes head', async () => (await Actions.accessKey.revokeSync(T.clientFor(dept), { accessKey: head } as any)).receipt.transactionHash)
await step('head pays after revoke (expect FAIL)', () => T.spendWithKeyOn(dept, { pk: headPk }, other, 1, 'probe'))
await step('dept balance', () => T.balanceOf(dept.address))
