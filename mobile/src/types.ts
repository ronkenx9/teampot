export type Role = 'admin' | 'lead' | 'employee' | 'contractor';

export type Person = {
  id: string;
  name: string;
  role: Role;
  title: string;
  team?: string;
  salary?: number;
  country?: string;
  balance: number;
  hasPasskey?: boolean;
  passkeyNeedsRefresh?: boolean;
  pot: { cap: number; left: number | null; resetsAt: number | null } | null;
};

export type Pot = {
  id: string;
  approved: number;
  team: string;
  perPersonCap: number;
  budget: number;
  balance: number;
  periodLabel: string;
  vendors: string[];
  vendorIds: string[];
  members: string[];
  color: string;
  accountMode: string;
};

export type Vendor = { id: string; name: string; category: string };
export type Perk = { id: string; personId: string; name: string; cap: number; periodLabel: 'day' | 'month' | 'year'; vendorIds: string[]; vendors: string[]; color: string; left: number | null; resetsAt: number | null };
export type Activity = { id: string; at: number; kind: string; title: string; detail: string; amount?: number; who?: string; potId?: string; perkId?: string; receipt?: string; memoLabel?: string };
export type Held = { id: string; at: number; personId: string; potId: string; vendorId: string; amount: number; note: string; reason: 'new-vendor' | 'over-limit' | 'finance-rule'; status: 'held' | 'approved' | 'returned'; tx?: string };
export type Invoice = { id: string; number: string; at: number; contractorId: string; amount: number; description: string; status: 'submitted' | 'paid' | 'declined'; paidMs?: number; tx?: string; declineReason?: string };
export type PaydayRun = { id: string; at: number; date: string; tx: string; total: number; count: number; ms: number; lines: { personId: string; gross: number; memo: string }[] };
export type StockId = 'aapl' | 'nvda' | 'spy';
export type Stock = { id: StockId; symbol: string; name: string; display: string; lastPrice: number; previousPrice: number; priceAsOf: number; priceSource: 'yahoo' | 'nasdaq' | 'fallback'; delayed: boolean; ready: boolean; setupError?: string };
export type Investment = {
  personId: string;
  election: { personId: string; stockId: StockId; percent: number } | null;
  positions: { stockId: StockId; shares: number; avgCost: number; cost: number; value: number; gain: number }[];
  trades: { id: string; at: number; personId: string; stockId: StockId; side: 'buy' | 'sell'; cashAmount: number; shares: number; price: number; tx: string; source: 'payday' | 'manual'; receipt: string }[];
};
export type EarnEntry = { personId: string; balance: number; mode: 'simulated' | 'real'; depositTx?: string; reason?: string; updatedAt: number };

export type State = {
  auth?: { personId: string; role: Role; demo: boolean };
  company: { name: string; balance: number; financeApprovalThreshold: number };
  nextPayday: string;
  people: Person[];
  pots: Pot[];
  vendors: Vendor[];
  perks: Perk[];
  activity: Activity[];
  held: Held[];
  invoices: Invoice[];
  paydayRuns: PaydayRun[];
  quarterCloses: unknown[];
  kudosCredits: unknown[];
  kudosAwards: unknown[];
  stocks: Stock[];
  investments: Investment[];
  earnEntries: EarnEntry[];
  simulatedEarnings: { label: string; amount: number; note: string };
  seeded: boolean;
};

export type DemoPerson = { id: 'jordan' | 'ava' | 'sam' | 'mateo'; label: string; role: Role };
export const demoPeople: DemoPerson[] = [
  { id: 'sam', label: 'Sam', role: 'employee' },
  { id: 'ava', label: 'Ava', role: 'lead' },
  { id: 'mateo', label: 'Mateo', role: 'contractor' },
  { id: 'jordan', label: 'Finance', role: 'admin' }
];
