export type Person = {
  id: string; name: string; role: 'admin' | 'lead' | 'employee' | 'contractor'; title: string
  team?: string; salary?: number; country?: string; balance: number; hasPasskey?: boolean
  pot: { cap: number; left: number | null; resetsAt: number | null } | null
}
export type Pot = { id: string; approved: number; team: string; perPersonCap: number; periodLabel: string; vendors: string[]; vendorIds: string[]; members: string[]; color: string }
export type Vendor = { id: string; name: string; category: string }
export type Activity = { id: string; at: number; kind: string; title: string; detail: string; amount?: number; who?: string; potId?: string; receipt?: string }
export type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit'; status: 'held' | 'approved' | 'returned' }
export type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid'; paidMs?: number }
export type State = { company: { name: string; balance: number }; people: Person[]; pots: Pot[]; vendors: Vendor[]; activity: Activity[]; held: Held[]; invoices: Invoice[]; seeded: boolean }

const j = async (r: Response) => {
  const body = await r.json()
  if (!r.ok) throw new Error(body.error || 'Something went wrong')
  return body
}
export const api = {
  state: (): Promise<State> => fetch('/api/state').then(j),
  setup: () => fetch('/api/setup', { method: 'POST' }).then(j),
  payday: () => fetch('/api/payday', { method: 'POST' }).then(j),
  spend: (b: { personId: string; vendorId: string; amount: number; note: string }) =>
    fetch('/api/spend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j),
  decide: (id: string, action: 'approve' | 'return') => fetch(`/api/held/${id}/${action}`, { method: 'POST' }).then(j),
  invoice: (b: { contractorId: string; amount: number; description: string }) =>
    fetch('/api/invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j),
  recordPasskey: (b: { personId: string; vendorId: string; amount: number; note: string; tx?: string; rejected?: boolean }) =>
    fetch('/api/passkey/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j),
  payInvoice: (id: string) => fetch(`/api/invoices/${id}/pay`, { method: 'POST' }).then(j),
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
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
