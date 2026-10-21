import 'dotenv/config'
import { createHmac } from 'node:crypto'
import { http, formatUnits, parseUnits, pad, stringToHex, keccak256, toHex } from 'viem'
import { Account, Actions, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { TxEnvelopeTempo, TokenId } from 'ox/tempo'
import type { PilotAdapter, PilotCommand, PreparedPilotTransaction, PilotChainResult } from './pilot-types.js'

export const PILOT_TOKEN = '0x20c0000000000000000000000000000000000000' as const
export const PILOT_CHAIN_ID = 42431
type Hex = `0x${string}`
const fail = (message: string): never => { throw Object.assign(new Error(message), { status: 503 }) }
function configuration() {
 if (process.env.TEMPO_NETWORK === 'mainnet') fail('Company testing is only available on Tempo testnet.')
 if (process.env.TEMPO_PAYMENT_TOKEN && process.env.TEMPO_PAYMENT_TOKEN.toLowerCase() !== PILOT_TOKEN) fail('Company testing requires test pathUSD.')
 const seed = process.env.PILOT_SIGNING_SECRET || process.env.OPERATOR_PK
 if (!seed || !/^0x[0-9a-f]{64}$/i.test(seed)) fail('Test payment signing is not configured.')
 return seed!
}
function derived(label: string): Hex {
 return ('0x' + createHmac('sha256', Buffer.from(configuration().slice(2), 'hex')).update(`teampot-company-pilot-v1:${label}`).digest('hex')) as Hex
}
const treasury = (w: string) => Account.fromSecp256k1(derived(`${w}:treasury`))
const department = (w: string, d: string) => Account.fromP256(derived(`${w}:department:${d}`))
const head = (w: string, d: string, m: string) => Account.fromP256(derived(`${w}:head:${d}:${m}`), { access: department(w, d) })
const card = (w: string, d: string, id: string) => Account.fromP256(derived(`${w}:card:${d}:${id}`), { access: department(w, d) })
const mk = (account?: any): any => createClient({ account, chain: tempoModerato.extend({ feeToken: PILOT_TOKEN }), transport: http(process.env.PILOT_TEMPO_RPC || process.env.TEMPO_RPC || undefined, { retryCount: 2, retryDelay: 500, timeout: 15000 }), testnet: true } as any)
async function assertNetwork(client: any) {
 configuration()
 if (await client.getChainId() !== PILOT_CHAIN_ID) fail('The payment connection is not Tempo Moderato testnet.')
}
const money = (n: number) => {
 if (!Number.isFinite(n) || n <= 0 || n > 10000 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new Error('Enter a positive amount with at most two decimal places, up to $10,000.')
 return parseUnits(n.toFixed(2), 6)
}
const memo = (s: string) => pad(stringToHex(s.slice(0, 30)), { size: 32, dir: 'right' })
const transfer = (to: string, amount: number, note: string) => Actions.token.transfer.call({ token: PILOT_TOKEN, to: to as Hex, amount: money(amount), memo: memo(note) })
function validatePrepared(prepared: PreparedPilotTransaction) {
 configuration()
 if (!/^0x76[0-9a-f]+$/i.test(prepared.raw)) fail('The saved transaction is not a Tempo transaction.')
 const tx = TxEnvelopeTempo.deserialize(prepared.raw as `0x76${string}`)
 if (tx.chainId !== PILOT_CHAIN_ID || !tx.signature || (typeof tx.feeToken === 'bigint' ? TokenId.toAddress(tx.feeToken) : tx.feeToken)?.toLowerCase() !== PILOT_TOKEN || TxEnvelopeTempo.hash(tx as any).toLowerCase() !== prepared.hash.toLowerCase()) fail('The saved test transaction could not be verified.')
 return tx
}
async function reconcile(prepared: PreparedPilotTransaction): Promise<PilotChainResult> {
 validatePrepared(prepared)
 const client = mk(); await assertNetwork(client)
 try {
  const receipt = await client.getTransactionReceipt({ hash: prepared.hash })
  if (receipt.transactionHash.toLowerCase() !== prepared.hash.toLowerCase()) fail('The test payment receipt did not match.')
  return { status: receipt.status === 'success' ? 'confirmed' : 'reverted', tx: prepared.hash, ...(receipt.status === 'success' ? {} : { error: 'Tempo rejected this transaction. No payment was completed.' }) }
 } catch (e: any) {
  if (e?.status) throw e
  // A missing receipt or unreadable RPC response is never proof of failure.
  return { status: 'pending', tx: prepared.hash }
 }
}

export function createPilotTempoAdapter(): PilotAdapter {
 return {
  network: 'testnet', chainId: PILOT_CHAIN_ID, token: PILOT_TOKEN,
  addresses(w, d, m, id) {
   return { treasury: treasury(w).address, ...(d ? { department: department(w, d).address } : {}), ...(d && m ? { headKey: head(w, d, m).accessKeyAddress } : {}), ...(d && id ? { cardKey: card(w, d, id).accessKeyAddress } : {}) }
  },
  vendors(w) { return ['Design supplies', 'Team software', 'Travel test vendor'].map((name, index) => ({ id: `vendor-${index + 1}`, name, address: Account.fromSecp256k1(derived(`${w}:vendor:${index + 1}`)).address })) },
  async balances(addresses) {
   const client = mk(); await assertNetwork(client)
   const result: Record<string, number> = {}
   for (const address of [...new Set(addresses)]) {
    const balance = await Actions.token.getBalance(client, { token: PILOT_TOKEN, account: address as Hex })
    result[address] = Number(formatUnits(balance.amount, 6))
   }
   return result
  },
  async prepare(command: PilotCommand) {
   configuration()
   const { workspaceId: w, departmentId: d, membershipId: m, headMembershipId: hm, cardId: id } = command
   let signer: any, calls: any[] | undefined, keyAuthorization: any
   if (command.action === 'provision') {
    const operator = process.env.OPERATOR_PK
    if (!operator || !/^0x[0-9a-f]{64}$/i.test(operator)) fail('Test funding is not configured.')
    signer = Account.fromSecp256k1(operator as Hex)
    calls = [transfer(treasury(w).address, 10000, 'Teampot test funding')]
   } else {
    if (!d) throw new Error('A department is required.')
    const root = department(w, d)
    if (command.action === 'fund') { signer = treasury(w); calls = [transfer(root.address, command.amount!, 'Department test budget')] }
    else if (command.action === 'delegate') {
     if (!m) throw new Error('Choose a lead.')
     signer = root
     keyAuthorization = await Actions.accessKey.signAuthorization(mk(signer), { accessKey: head(w, d, m), chainId: PILOT_CHAIN_ID, admin: true } as any)
    } else if (command.action === 'undelegate') {
     if (!hm && !m) throw new Error('Choose a lead to revoke.')
     signer = root; calls = [Actions.accessKey.revoke.call({ accessKey: head(w, d, (hm || m)!) })]
    } else if (command.action === 'issue') {
     if (!id || !hm || !command.vendorAddresses?.length) throw new Error('A lead and approved vendors are required.')
     signer = head(w, d, hm)
     keyAuthorization = await Actions.accessKey.signAuthorization(mk(signer), { accessKey: card(w, d, id), chainId: PILOT_CHAIN_ID, expiry: Math.floor(Date.now() / 1000) + 120 * 86400, limits: [{ token: PILOT_TOKEN, limit: money(command.cap!), period: 2592000 }], scopes: ['transfer(address,uint256)', 'transferWithMemo(address,uint256,bytes32)'].map(selector => ({ address: PILOT_TOKEN, selector, recipients: command.vendorAddresses })) } as any)
    } else if (command.action === 'spend') {
     if (!id || !command.to) throw new Error('Choose a card and vendor.')
     signer = card(w, d, id); calls = [transfer(command.to, command.amount!, command.note || 'Team test payment')]
    } else if (command.action === 'approve') {
     if (!command.to) throw new Error('Choose a request.')
     signer = hm ? head(w, d, hm) : root; calls = [transfer(command.to, command.amount!, command.note || 'Approved test payment')]
    } else if (command.action === 'revoke') {
     if (!id) throw new Error('Choose a card.')
     signer = hm ? head(w, d, hm) : root; calls = [Actions.accessKey.revoke.call({ accessKey: card(w, d, id) })]
    } else throw new Error('This action does not produce a transaction.')
   }
   const client = mk(signer); await assertNetwork(client)
   try {
    // Each durable operation owns a nonce lane. No second operation can reuse it,
    // including concurrent company provisioning signed by the funding operator.
    const nonceKey = BigInt(keccak256(toHex(`teampot-pilot:${w}:${command.operationId}`))) >> 8n
    const request = await client.prepareTransactionRequest({ ...(calls ? { calls } : {}), ...(keyAuthorization ? { keyAuthorization } : {}), nonceKey, nonce: 0, feeToken: PILOT_TOKEN })
    const raw = await client.signTransaction(request)
    const hash = TxEnvelopeTempo.hash(TxEnvelopeTempo.deserialize(raw) as any)
    return { raw, hash }
   } catch (error: any) {
    const details = String(error?.details || error?.shortMessage || error?.message || '')
    if (command.action === 'spend' && /(?:spending[ _-]?limit|SpendLimitExceeded|ExceededLimit|CallNotAllowed|call[ _-]?not[ _-]?allowed|access key.*limit|key.*spending limit)/i.test(details)) throw Object.assign(new Error('This payment is outside the card’s current spending rules. An authorized person needs to approve it.'), { code: 'POLICY_REJECTED' })
    throw Object.assign(new Error('The test transaction could not be prepared. Check the department balance and current card permissions, then try again.'), { cause: error })
   }
  },
  status: reconcile,
  async submit(prepared) {
   validatePrepared(prepared)
   const existing = await reconcile(prepared)
   if (existing.status !== 'pending') return existing
   const client = mk(); await assertNetwork(client)
   try {
    const hash = await client.sendRawTransaction({ serializedTransaction: prepared.raw })
    if (hash.toLowerCase() !== prepared.hash.toLowerCase()) fail('The test network returned a different transaction reference.')
    await client.waitForTransactionReceipt({ hash, timeout: 15000, pollingInterval: 1000 })
   } catch { /* Signed bytes remain saved. A later retry checks the same hash. */ }
   return reconcile(prepared)
  }
 }
}
