export type Role = 'admin' | 'lead' | 'employee' | 'contractor'
export type StockId = 'aapl' | 'nvda' | 'spy'
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
  removed?: boolean
}
export type Vendor = { id: string; name: string; category: string; address: string }
export type TestStock = {
  id: StockId
  symbol: string
  name: string
  display: string
  tokenAddress?: string
  createTx?: string
  pairTx?: string
  mintTx?: string
  bidTx?: string
  askTx?: string
  lastPrice: number
  previousPrice: number
  priceAsOf: number
  priceSource: 'yahoo' | 'nasdaq' | 'fallback'
  delayed: boolean
  setupError?: string
}
export type PayElection = { personId: string; stockId: StockId; percent: number }
export type StockTrade = {
  id: string
  at: number
  personId: string
  stockId: StockId
  side: 'buy' | 'sell'
  cashAmount: number
  shares: number
  price: number
  tx: string
  source: 'payday' | 'manual'
}
export type EarnEntry = { personId: string; balance: number; mode: 'simulated' | 'real'; depositTx?: string; reason?: string; updatedAt: number }
export type Pot = {
  id: string
  team: string
  perPersonCap: number
  budget: number
  periodLabel: string
  periodSec: number
  vendorIds: string[]
  color: string
  fundTx?: string
  returnTx?: string
  rootMode?: 'demo-server-p256' | 'head-passkey-pending'
}
export type Perk = { id: string; personId: string; name: string; cap: number; periodLabel: string; periodSec: number; vendorIds: string[]; color: string; keyTx?: string }
export type ActivityKind = 'payday' | 'spend' | 'held' | 'approved' | 'returned' | 'invoice' | 'paid' | 'setup' | 'perk' | 'quarter' | 'kudos' | 'declined' | 'admin' | 'invest' | 'earn'
export type Activity = { id: string; at: number; kind: ActivityKind; title: string; detail: string; amount?: number; who?: string; tx?: string; potId?: string; perkId?: string; memo?: string }
export type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit' | 'finance-rule'; status: 'held' | 'approved' | 'returned'; tx?: string }
export type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid' | 'declined'; tx?: string; paidMs?: number; declineReason?: string }
export type PaydayRun = { id: string; at: number; date: string; tx: string; total: number; count: number; ms: number; lines: { personId: string; gross: number; memo: string }[] }
export type QuarterClose = { id: string; at: number; potId: string; savings: number; sharePct: number; pool: number; perPerson: number; tx: string; memberIds: string[] }
export type KudosCredit = { personId: string; closeId: string; left: number }
export type KudosAward = { id: string; at: number; fromPersonId: string; toPersonId: string; amount: number; note: string; tx: string }
export type Processed = Record<string, unknown>
export type Session = { id: string; personId: string; demo: boolean; createdAt: number; expiresAt: number }
export type AuthChallenge = { id: string; personId: string; challenge: `0x${string}`; createdAt: number; expiresAt: number }
export type Invite = {
  token: string
  personId: string
  createdBy: string
  createdAt: number
  expiresAt: number
  usedAt?: number
}
export type State = {
  version: number
  epoch: string
  company: { name: string; address: string; financeApprovalThreshold: number }
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
  stocks: TestStock[]
  payElections: PayElection[]
  stockTrades: StockTrade[]
  earnEntries: EarnEntry[]
  nextPayday: string
  processed: Processed
  sessions: Session[]
  revokedSessions?: string[]
  authChallenges: AuthChallenge[]
  invites: Invite[]
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
  const people = base.people ?? []
  const pots = (base.pots ?? []).map((p) => ({
    ...p,
    budget: (p as Pot).budget ?? ((p as Pot).perPersonCap ?? 0) * Math.max(1, people.filter((x) => x.team === (p as Pot).id).length),
    rootMode: (p as Pot).rootMode ?? 'demo-server-p256',
  }))
  return {
    ...base,
    version: base.version ?? 0,
    company: { ...(base.company as State['company']), financeApprovalThreshold: (base.company as State['company'])?.financeApprovalThreshold ?? 1000 },
    pots,
    perks: base.perks ?? [],
    paydayRuns: base.paydayRuns ?? [],
    quarterCloses: base.quarterCloses ?? [],
    kudosCredits: base.kudosCredits ?? [],
    kudosAwards: base.kudosAwards ?? [],
    stocks: base.stocks ?? defaultStocks(),
    payElections: base.payElections ?? [],
    stockTrades: base.stockTrades ?? [],
    earnEntries: base.earnEntries ?? [],
    nextPayday: base.nextPayday ?? nextMonthlyDate(),
    processed: base.processed ?? {},
    sessions: base.sessions ?? [],
    authChallenges: base.authChallenges ?? [],
    invites: base.invites ?? [],
  } as State
}

export function defaultStocks(now = Date.now()): TestStock[] {
  return [
    { id: 'aapl', symbol: 'AAPL', name: 'Apple test stock', display: 'AAPL (test)', lastPrice: 254, previousPrice: 250, priceAsOf: now, priceSource: 'fallback', delayed: true },
    { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA test stock', display: 'NVDA (test)', lastPrice: 185, previousPrice: 180, priceAsOf: now, priceSource: 'fallback', delayed: true },
    { id: 'spy', symbol: 'SPY', name: 'S&P 500 test fund', display: 'SPY (test)', lastPrice: 670, previousPrice: 665, priceAsOf: now, priceSource: 'fallback', delayed: true },
  ]
}

export function applyStockTrade(trades: StockTrade[], trade: Omit<StockTrade, 'id' | 'at'> & Partial<Pick<StockTrade, 'id' | 'at'>>) {
  trades.unshift({ id: trade.id ?? uid(), at: trade.at ?? Date.now(), ...trade })
}

export function stockPosition(trades: StockTrade[], personId: string, stockId: StockId, currentPrice: number) {
  let shares = 0
  let cost = 0
  for (const t of trades.filter((x) => x.personId === personId && x.stockId === stockId).reverse()) {
    if (t.side === 'buy') {
      shares = roundMoney(shares + t.shares)
      cost = roundMoney(cost + t.cashAmount)
    } else {
      const avg = shares > 0 ? cost / shares : 0
      shares = roundMoney(Math.max(0, shares - t.shares))
      cost = roundMoney(Math.max(0, cost - avg * t.shares))
    }
  }
  const avgCost = shares > 0 ? roundMoney(cost / shares) : 0
  const value = roundMoney(shares * currentPrice)
  return { shares, avgCost, cost: roundMoney(cost), value, gain: roundMoney(value - cost) }
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
