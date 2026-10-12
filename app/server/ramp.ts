// Bank rails (Bridge, Stripe's stablecoin company). Companies keep their bank: they fund the treasury by ACH or wire
// into a Bridge virtual account that lands as stablecoin on Tempo, and people cash out to their own bank through a
// Bridge liquidation address. With BRIDGE_API_KEY unset everything runs in simulated mode: the money still really
// moves on Tempo testnet, but a "bank desk" account stands in for Bridge's settlement wallet.

export const rampMode = (): 'bridge' | 'simulated' => (process.env.BRIDGE_API_KEY ? 'bridge' : 'simulated')
const BASE = () => process.env.BRIDGE_API || 'https://api.bridge.xyz'
/** Chain and stablecoin Bridge settles on. Tempo is the target; both are configurable until Bridge lists the rail name. */
export const BRIDGE_RAIL = () => process.env.BRIDGE_RAIL || 'tempo'
export const BRIDGE_CURRENCY = () => process.env.BRIDGE_CURRENCY || 'usdc'
export const ACH_DAYS = '1–2 business days'

async function bridge(path: string, body: unknown, idem: string) {
  const key = process.env.BRIDGE_API_KEY
  if (!key) throw new Error('Bank rails not connected')
  const r = await fetch(`${BASE()}/v0/${path}`, {
    method: 'POST',
    headers: { 'Api-Key': key, 'Idempotency-Key': idem, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.message || j?.error || `Bridge ${path} failed`)
  return j
}

export type DepositInstructions = { mode: 'bridge' | 'simulated'; bankName: string; beneficiary: string; routing: string; account: string; rails: string[]; virtualAccountId?: string }

/** Bank details the company sends ACH/wires to. Bridge: a virtual account whose deposits land in the treasury on Tempo. */
export async function depositInstructions(company: { name: string; address: string }, epoch: string, existing?: DepositInstructions): Promise<DepositInstructions> {
  if (rampMode() === 'simulated') {
    const n = [...company.address.toLowerCase()].reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 1e9, 11)
    return { mode: 'simulated', bankName: 'Simulated bank (Bridge test)', beneficiary: company.name, routing: '000000000', account: String(n).padStart(10, '0'), rails: ['ACH', 'Wire'] }
  }
  if (existing?.mode === 'bridge') return existing
  const customer = process.env.BRIDGE_CUSTOMER_ID
  if (!customer) throw new Error('Set BRIDGE_CUSTOMER_ID to the company’s Bridge customer')
  const va = await bridge(`customers/${customer}/virtual_accounts`, {
    source: { currency: 'usd' },
    destination: { currency: BRIDGE_CURRENCY(), payment_rail: BRIDGE_RAIL(), address: company.address },
  }, `teampot-va-${epoch}`)
  const d = va.source_deposit_instructions ?? {}
  return {
    mode: 'bridge', virtualAccountId: va.id, bankName: d.bank_name ?? 'Bank', beneficiary: d.bank_beneficiary_name ?? company.name,
    routing: d.bank_routing_number ?? '', account: d.bank_account_number ?? '', rails: (d.payment_rails ?? ['ach_push', 'wire']).map((r: string) => (r.startsWith('ach') ? 'ACH' : r === 'wire' ? 'Wire' : r)),
  }
}

export type BankInput = { holder: string; bankName: string; routing: string; account: string; type: 'checking' | 'savings' }

/**
 * Links a bank account for cash-outs. Bridge: an external account plus a liquidation address (stablecoin sent to it
 * is paid out to the bank). Full account numbers go to Bridge only; Teampot keeps the bank name and last four digits.
 */
export async function linkBank(customerId: string | undefined, b: BankInput, idem: string) {
  const last4 = b.account.slice(-4)
  if (rampMode() === 'simulated') return { mode: 'simulated' as const, last4 }
  if (!customerId) throw Object.assign(new Error('Verify your identity with Bridge before linking a bank'), { status: 409 })
  const ext = await bridge(`customers/${customerId}/external_accounts`, {
    currency: 'usd', account_type: 'us', bank_name: b.bankName, account_owner_name: b.holder, account_owner_type: 'individual',
    account: { account_number: b.account, routing_number: b.routing, checking_or_savings: b.type },
  }, `${idem}-ext`)
  const liq = await bridge(`customers/${customerId}/liquidation_addresses`, {
    chain: BRIDGE_RAIL(), currency: BRIDGE_CURRENCY(), external_account_id: ext.id, destination_payment_rail: 'ach', destination_currency: 'usd',
  }, `${idem}-liq`)
  return { mode: 'bridge' as const, last4, externalId: ext.id as string, payoutAddress: liq.address as string }
}

export const validRouting = (r: string) => {
  if (!/^\d{9}$/.test(r)) return false
  const d = [...r].map(Number)
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0
}
