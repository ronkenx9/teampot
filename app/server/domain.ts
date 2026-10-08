export type Role = 'admin' | 'lead' | 'employee' | 'contractor'
export type Person = {
  id: string
  name: string
  role: Role
  team?: string
  title: string
  salary?: number
  address: string
  demoKey?: boolean
  keyVersion?: number
  keyTx?: string
  passkey?: { id: string; publicKey: `0x${string}`; tx: string; needsRefresh?: boolean }
  country?: string
}
export type Vendor = { id: string; name: string; category: string; address: string }
export type Pot = { id: string; team: string; perPersonCap: number; periodLabel: string; periodSec: number; vendorIds: string[]; color: string }
export type Perk = { id: string; personId: string; name: string; cap: number; periodLabel: string; periodSec: number; vendorIds: string[]; color: string; keyTx?: string }
export type ActivityKind = 'payday' | 'spend' | 'held' | 'approved' | 'returned' | 'invoice' | 'paid' | 'setup' | 'perk' | 'quarter' | 'kudos' | 'declined' | 'admin'
export type Activity = { id: string; at: number; kind: ActivityKind; title: string; detail: string; amount?: number; who?: string; tx?: string; potId?: string; perkId?: string; memo?: string }
export type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit'; status: 'held' | 'approved' | 'returned'; tx?: string }
export type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid' | 'declined'; tx?: string; paidMs?: number; declineReason?: string }
export type PaydayRun = { id: string; at: number; date: string; tx: string; total: number; count: number; ms: number; lines: { personId: string; gross: number; memo: string }[] }
export type QuarterClose = { id: string; at: number; potId: string; savings: number; sharePct: number; pool: number; perPerson: number; tx: string; memberIds: string[] }
export type KudosCredit = { personId: string; closeId: string; left: number }
export type KudosAward = { id: string; at: number; fromPersonId: string; toPersonId: string; amount: number; note: string; tx: string }
export type Processed = Record<string, unknown>
export type State = {
  epoch: string
  company: { name: string; address: string }
  people: Person[]
  vendors: Vendor[]
  pots: Pot[]
  perks: Perk[]
  activity: Activity[]
  held: Held[]
  invoices: Invoice[]
  paydayRuns: PaydayRun[]
  quarterCloses: QuarterClose[]
  kudosCredits: KudosCredit[]
  kudosAwards: KudosAward[]
  nextPayday: string
  processed: Processed
  seeded: boolean
}

export const DAY = 86400
export const MONTH = 30 * DAY
export const YEAR = 365 * DAY

export const uid = () => Math.random().toString(36).slice(2, 10)
export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || uid()
export const roundMoney = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const moneyMemo = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 31)

export function nextMonthlyDate(now = new Date()) {
  const d = new Date(now)
  d.setUTCDate(Math.min(28, d.getUTCDate()))
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export function normalizeState(s: Partial<State> | null, seed: () => State): State {
  const base = s ?? seed()
  return {
    ...base,
    perks: base.perks ?? [],
    paydayRuns: base.paydayRuns ?? [],
    quarterCloses: base.quarterCloses ?? [],
    kudosCredits: base.kudosCredits ?? [],
    kudosAwards: base.kudosAwards ?? [],
    nextPayday: base.nextPayday ?? nextMonthlyDate(),
    processed: base.processed ?? {},
  } as State
}

export function idempotent<T>(state: State, key: string | undefined, work: () => T): T {
  if (!key) return work()
  if (Object.prototype.hasOwnProperty.call(state.processed, key)) return state.processed[key] as T
  const result = work()
  state.processed[key] = result
  return result
}

export function holdReason(pot: Pot, vendorId: string) {
  return pot.vendorIds.includes(vendorId) ? 'over-limit' : 'new-vendor'
}

export function potApprovedTotal(state: Pick<State, 'held'>, potId: string) {
  return state.held.filter((h) => h.potId === potId && h.status === 'approved').reduce((a, h) => a + h.amount, 0)
}

export function potSavings(memberRemaining: number[], approvedTotal = 0) {
  return Math.max(0, roundMoney(memberRemaining.reduce((a, n) => a + Math.max(0, n), 0) - approvedTotal))
}

export function splitKudos(savings: number, sharePct: number, memberIds: string[]) {
  const pool = roundMoney(Math.max(0, savings) * Math.max(0, Math.min(100, sharePct)) / 100)
  if (!memberIds.length) return { pool, perPerson: 0, lines: [] as { personId: string; amount: number }[] }
  const perPerson = Math.floor((pool / memberIds.length) * 100) / 100
  let remainder = roundMoney(pool - perPerson * memberIds.length)
  const lines = memberIds.map((personId) => {
    const bump = remainder >= 0.01 ? 0.01 : 0
    remainder = roundMoney(remainder - bump)
    return { personId, amount: roundMoney(perPerson + bump) }
  })
  return { pool, perPerson: lines[0]?.amount ?? 0, lines }
}

export function canAwardKudos(credits: KudosCredit[], fromPersonId: string, amount: number) {
  const left = credits.filter((c) => c.personId === fromPersonId).reduce((a, c) => a + c.left, 0)
  return { ok: amount > 0 && left >= amount, left: roundMoney(left) }
}

export function applyKudosDebit(credits: KudosCredit[], fromPersonId: string, amount: number) {
  let remaining = roundMoney(amount)
  for (const credit of credits.filter((c) => c.personId === fromPersonId && c.left > 0)) {
    const take = Math.min(credit.left, remaining)
    credit.left = roundMoney(credit.left - take)
    remaining = roundMoney(remaining - take)
    if (remaining <= 0) break
  }
  return remaining <= 0
}

export function invoiceNumber(existing: Invoice[]) {
  return `INV-${String(1041 + existing.length).padStart(4, '0')}`
}

export function decodeMemoLabel(raw?: string) {
  if (!raw) return 'Teampot memo'
  const [kind, rest] = raw.split(':')
  if (!rest) return raw
  const labels: Record<string, string> = { design: 'Design pot', eng: 'Engineering pot', mkt: 'Marketing pot', perk: 'Perk', payday: 'Payday', kudos: 'Kudos' }
  return `${labels[kind] ?? kind} · ${rest}`
}
