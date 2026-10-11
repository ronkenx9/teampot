// Card issuer bridge (Stripe Issuing). Teampot cards are Tempo access keys; the issuer's Visa card is a second
// rail over the same rules. With STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET unset, everything runs in simulated mode.
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Visa merchant category codes → the vendor categories Teampot cards use. */
export const MCC: Record<string, { category: string; label: string }> = {
  '5734': { category: 'Software', label: 'Computer software stores' },
  '5817': { category: 'Software', label: 'Digital goods: apps' },
  '7372': { category: 'Cloud', label: 'Computer programming and data processing' },
  '4816': { category: 'Cloud', label: 'Computer network and information services' },
  '4511': { category: 'Travel', label: 'Airlines' },
  '7011': { category: 'Travel', label: 'Hotels and lodging' },
  '5812': { category: 'Meals', label: 'Restaurants' },
  '5814': { category: 'Meals', label: 'Fast food' },
  '8299': { category: 'Learning', label: 'Schools and educational services' },
  '7333': { category: 'Assets', label: 'Commercial photography and graphics' },
  '5732': { category: 'Electronics', label: 'Electronics stores' },
}
export const categoryForMcc = (mcc: string) => MCC[mcc]?.category ?? 'Other'

/** Stripe-style named categories (as sent in issuing_authorization.merchant_data.category) → MCC. */
export const STRIPE_CATEGORY_MCC: Record<string, string> = {
  computer_software_stores: '5734', digital_goods_applications: '5817', computer_programming: '7372', computer_network_services: '4816',
  airlines_air_carriers: '4511', hotels_motels_and_resorts: '7011', eating_places_restaurants: '5812', fast_food_restaurants: '5814',
  schools_and_educational_services: '8299', commercial_photography_art_and_graphics: '7333', electronics_stores: '5732',
}

export const issuerMode = (): 'stripe' | 'simulated' => (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'simulated')

/** Verifies a Stripe-Signature header (t=…,v1=…) over the raw body. */
export function verifyStripeSignature(raw: string, header: string | undefined, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]))
  const t = Number(parts.t)
  if (!t || Math.abs(nowSec - t) > toleranceSec) return false
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3))
  return sigs.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
}

/** Minimal form-encoded Stripe API call. */
export async function stripe(path: string, params: Record<string, string | number | undefined>) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Card issuer not connected')
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v))
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' }, body })
  const j: any = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || `Stripe ${path} failed`)
  return j
}

/** Billing address for cardholders (Stripe requires one). JSON in ISSUING_BILLING_ADDRESS, else a placeholder. */
export function billingAddress() {
  try { if (process.env.ISSUING_BILLING_ADDRESS) return JSON.parse(process.env.ISSUING_BILLING_ADDRESS) } catch { /* fall through */ }
  return { line1: '1 Market St', city: 'San Francisco', state: 'CA', postal_code: '94105', country: 'US' }
}

/** Creates (or simulates) a virtual Visa card for a person. */
export async function issueVisaCard(person: { id: string; name: string }) {
  if (issuerMode() === 'simulated') {
    const n = [...person.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 10000, 7)
    const now = new Date()
    return { mode: 'simulated' as const, id: `sim_card_${person.id}`, last4: String(n).padStart(4, '0'), expMonth: now.getUTCMonth() + 1, expYear: now.getUTCFullYear() + 3, issuedAt: Date.now() }
  }
  const a = billingAddress()
  const holder = await stripe('issuing/cardholders', {
    type: 'individual', name: person.name, 'billing[address][line1]': a.line1, 'billing[address][city]': a.city,
    'billing[address][state]': a.state, 'billing[address][postal_code]': a.postal_code, 'billing[address][country]': a.country,
    'metadata[teampot_person]': person.id,
  })
  const card = await stripe('issuing/cards', { cardholder: holder.id, currency: 'usd', type: 'virtual', status: 'active', 'metadata[teampot_person]': person.id })
  return { mode: 'stripe' as const, id: card.id as string, last4: card.last4 as string, expMonth: card.exp_month as number, expYear: card.exp_year as number, cardholderId: holder.id as string, issuedAt: Date.now() }
}
