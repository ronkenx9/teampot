export type Person = {
  id: string; name: string; role: 'admin' | 'lead' | 'employee' | 'contractor'; title: string
  team?: string; salary?: number; country?: string; balance: number; hasPasskey?: boolean; passkeyNeedsRefresh?: boolean
  pot: { cap: number; left: number | null; resetsAt: number | null } | null
}
export type Pot = { id: string; approved: number; team: string; perPersonCap: number; budget: number; balance: number; periodLabel: string; vendors: string[]; vendorIds: string[]; members: string[]; color: string; accountMode: string }
export type Vendor = { id: string; name: string; category: string }
export type Perk = { id: string; personId: string; name: string; cap: number; periodLabel: 'day' | 'month' | 'year'; vendorIds: string[]; vendors: string[]; color: string; left: number | null; resetsAt: number | null }
export type Activity = { id: string; at: number; kind: string; title: string; detail: string; amount?: number; who?: string; potId?: string; perkId?: string; receipt?: string; memoLabel?: string }
export type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit'; status: 'held' | 'approved' | 'returned'; tx?: string }
export type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid' | 'declined'; paidMs?: number; tx?: string; declineReason?: string }
export type PaydayRun = { id: string; at: number; date: string; tx: string; total: number; count: number; ms: number; lines: { personId: string; gross: number; memo: string }[] }
export type QuarterClose = { id: string; at: number; potId: string; savings: number; sharePct: number; pool: number; perPerson: number; tx: string; memberIds: string[] }
export type KudosCredit = { personId: string; closeId: string; left: number }
export type KudosAward = { id: string; at: number; fromPersonId: string; toPersonId: string; amount: number; note: string; tx: string }
export type State = {
  auth?: { personId: string; role: Person['role']; demo: boolean }
  company: { name: string; balance: number; financeApprovalThreshold: number }; nextPayday: string
  people: Person[]; pots: Pot[]; vendors: Vendor[]; perks: Perk[]; activity: Activity[]; held: Held[]; invoices: Invoice[]
  paydayRuns: PaydayRun[]; quarterCloses: QuarterClose[]; kudosCredits: KudosCredit[]; kudosAwards: KudosAward[]
  simulatedEarnings: { label: string; amount: number; note: string }; seeded: boolean
}

const requestId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
const j = async (r: Response) => {
  const body = await r.json()
  if (!r.ok) throw new Error(body.error || 'Something went sideways')
  return body
}
const post = (url: string, body?: Record<string, unknown>) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(j)

export const api = {
  me: (): Promise<{ signedIn: boolean; demo?: boolean; personId?: string; role?: Person['role'] }> => fetch('/api/me').then(j),
  demo: (personId: string) => post('/api/auth/demo', { personId }),
  logout: () => post('/api/auth/logout'),
  challenge: (personId: string): Promise<{ id: string; challenge: `0x${string}`; credentialId: string }> => post('/api/auth/challenge', { personId }),
  verify: (b: { personId: string; challengeId: string; metadata: any; signature: `0x${string}` }) => post('/api/auth/verify', b),
  state: (): Promise<State> => fetch('/api/state').then(j),
  setup: (body?: { companyName?: string; departments?: { team: string; budget: number; perPersonCap: number; color?: string; headName?: string; headTitle?: string }[]; invites?: { name: string; role?: 'employee' | 'contractor'; title: string; team: string; salary?: number; country?: string }[] }) => post('/api/setup', body ?? {}),
  paydayPreview: () => fetch('/api/payday/preview').then(j),
  setPayday: (date: string) => post('/api/settings/payday', { date }),
  payday: () => post('/api/payday', { requestId: requestId('payday') }),
  spend: (b: { personId: string; vendorId: string; amount: number; note: string; source?: 'pot' | 'perk'; perkId?: string }) =>
    post('/api/spend', { ...b, requestId: requestId('spend') }),
  decide: (id: string, action: 'approve' | 'approve-add' | 'return', approverId: string) => post(`/api/held/${id}/${action}`, { requestId: requestId(`held-${id}`), approverId }),
  vendor: (b: { name: string; category: string }) => post('/api/vendors', b),
  person: (b: { name: string; role: Person['role']; title: string; team?: string; salary?: number; country?: string }) => post('/api/people', b),
  updatePerson: (id: string, b: Partial<{ name: string; role: Person['role']; title: string; team: string; salary: number; country: string }>) => post(`/api/people/${id}/update`, b),
  removePerson: (id: string) => post(`/api/people/${id}/remove`),
  invite: (b: { name: string; role: Exclude<Person['role'], 'admin'>; title: string; team: string; salary?: number; country?: string }) => post('/api/invites', b),
  inviteInfo: (token: string) => fetch(`/api/invites/${encodeURIComponent(token)}`).then(j),
  acceptInvite: (token: string, b: { id: string; publicKey: `0x${string}` }) => post(`/api/invites/${encodeURIComponent(token)}/accept`, b),
  financeRule: (threshold: number) => post('/api/settings/finance-rule', { threshold }),
  pot: (b: { team: string; perPersonCap: number; budget?: number; vendorIds: string[]; color?: string }) => post('/api/pots', b),
  updatePot: (id: string, b: Partial<{ team: string; perPersonCap: number; budget: number; vendorIds: string[]; color: string }>) => post(`/api/pots/${id}/update`, b),
  fundPot: (id: string, amount: number) => post(`/api/pots/${id}/fund`, { amount, requestId: requestId(`fund-${id}`) }),
  topupRequest: (id: string, amount: number) => post(`/api/pots/${id}/topup-request`, { amount, requestId: requestId(`topup-${id}`) }),
  returnPot: (id: string, amount: number) => post(`/api/pots/${id}/return`, { amount, requestId: requestId(`return-${id}`) }),
  perk: (b: { personId: string; name: string; cap: number; periodLabel: 'day' | 'month' | 'year'; vendorIds: string[]; color?: string }) => post('/api/perks', b),
  closeQuarter: (potId: string, sharePct: number) => post(`/api/pots/${potId}/close`, { sharePct, requestId: requestId(`close-${potId}`) }),
  kudos: (b: { fromPersonId: string; toPersonId: string; amount: number; note: string }) => post('/api/kudos', { ...b, requestId: requestId('kudos') }),
  invoice: (b: { contractorId: string; amount: number; description: string }) => post('/api/invoices', { ...b, requestId: requestId('invoice') }),
  declineInvoice: (id: string, reason: string) => post(`/api/invoices/${id}/decline`, { reason, requestId: requestId(`decline-${id}`) }),
  recordPasskey: (b: { personId: string; vendorId: string; amount: number; note: string; tx?: string; rejected?: boolean }) =>
    post('/api/passkey/record', { ...b, requestId: requestId('passkey') }),
  payInvoice: (id: string) => post(`/api/invoices/${id}/pay`, { requestId: requestId(`invoice-${id}`) }),
  receipt: (id: string) => fetch(`/api/receipts/${id}`).then(j),
  activityCsv: () => '/api/activity.csv',
}

export const money = (n: number, cents = false) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
export const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}
export const resetDate = (unix: number | null) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'
