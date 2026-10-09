// Thin Tempo layer for Teampot. Finance uses the company root; each department has its own
// demo P256 root that funds and authorizes that department's cards.
import 'dotenv/config'
import { http, parseUnits, formatUnits, pad, stringToHex, parseEventLogs, erc20Abi, keccak256, concat, toHex } from 'viem'
import { Address, PublicKey } from 'ox'
import { generatePrivateKey } from 'viem/accounts'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'

export const TOKEN = '0x20c0000000000000000000000000000000000000' as const // pathUSD, 6 dp
export const EXPLORER = 'https://explore.testnet.tempo.xyz/tx/'
const chain: any = (tempoModerato as any).extend({ feeToken: TOKEN })
const mk = (account: any) => createClient({ account, chain, transport: http(), testnet: true } as any) as any

export const companyAccount = Account.fromSecp256k1(process.env.OPERATOR_PK as `0x${string}`)
export const company = mk(companyAccount)

export const usd = (n: number | string) => parseUnits(String(n), 6)
export const fmt = (v: bigint) => Number(formatUnits(v, 6))
export const memo = (s: string) => pad(stringToHex(s.slice(0, 31)), { size: 32, dir: 'right' })

export const newKeyPk = () => generatePrivateKey()
/** Demo spending key for a person, derived from the server secret so stored state never contains key material. */
export const derivedKeyPk = (epoch: string, personId: string, purpose = 'pot') =>
  keccak256(concat([process.env.OPERATOR_PK as `0x${string}`, toHex(`teampot:${epoch}:${personId}:${purpose}`)]))
export const newAddress = () => Account.fromSecp256k1(generatePrivateKey()).address
export const p256Root = (pk: `0x${string}`) => Account.fromP256(pk)
export const p256RootAddress = (pk: `0x${string}`) => p256Root(pk).address
export const derivedDepartmentRootPk = (epoch: string, departmentId: string) =>
  derivedKeyPk(epoch, departmentId, 'department-root')
const keyAccount = (pk: `0x${string}`, source: any = companyAccount) => Account.fromP256(pk, { access: source } as any)
/** A spending key is either a demo P256 key held by the server or a device passkey (public key only). */
export type KeyRef = { pk: `0x${string}` } | { passkey: `0x${string}` }
const keyParam = (k: KeyRef, source: any = companyAccount): any => ('pk' in k ? keyAccount(k.pk, source) : { publicKey: k.passkey, type: 'webAuthn' })
export const keyAddress = (pk: `0x${string}`, source: any = companyAccount) => keyAccount(pk, source).address

export async function balanceOf(address: string) {
  const b: any = await Actions.token.getBalance(company, { token: TOKEN, account: address } as any)
  return Number(b.formatted ?? fmt(BigInt(b.amount ?? b)))
}

export function clientFor(account: any) {
  return mk(account)
}

export function rootFromPk(pk: `0x${string}`) {
  return p256Root(pk)
}

/** Issue a spending key on an account: cap per period + vendor allowlist. */
export async function issueKeyOn(source: any, k: KeyRef, capUsd: number, periodSec: number, vendors: string[], days = 120) {
  const scopes = vendors.length
    ? ['transfer(address,uint256)', 'transferWithMemo(address,uint256,bytes32)'].map((selector) => ({ address: TOKEN, selector, recipients: vendors }))
    : undefined
  const r = await Actions.accessKey.authorizeSync(mk(source), {
    accessKey: keyParam(k, source),
    expiry: Math.floor(Date.now() / 1000) + days * 86400,
    limits: [{ token: TOKEN, limit: usd(capUsd), period: periodSec }],
    scopes,
  } as any)
  return (r.receipt ?? r).transactionHash as string
}

export const issueKey = (k: KeyRef, capUsd: number, periodSec: number, vendors: string[], days = 120) =>
  issueKeyOn(companyAccount, k, capUsd, periodSec, vendors, days)

export async function remainingOn(source: any, k: KeyRef) {
  const accessKey = 'pk' in k ? keyAccount(k.pk, source) : Address.fromPublicKey(PublicKey.fromHex(k.passkey))
  const r: any = await Actions.accessKey.getRemainingLimit(mk(source), { account: source, accessKey, token: TOKEN } as any)
  return { remaining: fmt(r.remaining), periodEnd: r.periodEnd ? Number(r.periodEnd) : null }
}

export const remaining = (k: KeyRef) => remainingOn(companyAccount, k)

/** Spend from an account with a person's key. The key acts as the source account. Throws on chain rejection. */
export async function spendWithKeyOn(source: any, k: KeyRef | `0x${string}`, to: string, amountUsd: number, note: string) {
  const ref = typeof k === 'string' ? { pk: k } : k
  const client = mk(keyParam(ref, source))
  const { receipt } = await client.token.transferSync({ token: TOKEN, to, amount: usd(amountUsd), memo: memo(note) } as any)
  return receipt.transactionHash as string
}

export const spendWithKey = (k: KeyRef | `0x${string}`, to: string, amountUsd: number, note: string) =>
  spendWithKeyOn(companyAccount, k, to, amountUsd, note)

/** Company pays someone directly (approvals, contractors). */
export async function companyPay(to: string, amountUsd: number, note: string) {
  const { receipt } = await company.token.transferSync({ token: TOKEN, to, amount: usd(amountUsd), memo: memo(note) } as any)
  return receipt.transactionHash as string
}

export async function payFrom(source: any, to: string, amountUsd: number, note: string) {
  const { receipt } = await mk(source).token.transferSync({ token: TOKEN, to, amount: usd(amountUsd), memo: memo(note) } as any)
  return receipt.transactionHash as string
}

/** Payday: one atomic batch transaction paying everyone, each line with its own memo. */
export async function payday(lines: { to: string; amount: number; note: string }[]) {
  return paydayFrom(companyAccount, lines)
}

export async function paydayFrom(source: any, lines: { to: string; amount: number; note: string }[]) {
  const calls = lines.map((l) => Actions.token.transfer.call({ token: TOKEN, to: l.to, amount: usd(l.amount), memo: memo(l.note) } as any))
  const t0 = Date.now()
  const r = await mk(source).sendTransactionSync({ calls })
  return { tx: r.transactionHash as string, ms: Date.now() - t0, status: r.status as string }
}


export function receiptHasSpend(r: any, to: string, amountUsd: number, from = companyAccount.address) {
  if (!r || r.status !== 'success') return false
  const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: r.logs }) as any[]
  return transfers.some((l) => l.address.toLowerCase() === TOKEN && l.args.from.toLowerCase() === from.toLowerCase()
    && l.args.to.toLowerCase() === to.toLowerCase() && l.args.value === usd(amountUsd))
}

/** Confirm a payment the device sent: it succeeded, left the company account, and paid `to` exactly `amountUsd`. */
export async function verifySpend(tx: `0x${string}`, to: string, amountUsd: number, from = companyAccount.address) {
  const r: any = await company.getTransactionReceipt({ hash: tx }).catch(() => null)
  return receiptHasSpend(r, to, amountUsd, from)
}

/** Revoke a spending key (e.g. the demo key once a device passkey replaces it). */
export async function revokeKeyOn(source: any, k: KeyRef) {
  const r: any = await Actions.accessKey.revokeSync(mk(source), { accessKey: keyParam(k, source) } as any)
  return (r.receipt ?? r).transactionHash as string
}

export const revokeKey = (k: KeyRef) => revokeKeyOn(companyAccount, k)
