import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ago, money, resetDate, type Activity, type Held, type Invoice, type Person, type State } from './api'
import { enrollPasskey, passkeysSupported, payWithPasskey } from './passkey'

type Viewer = 'jordan' | 'ava' | 'sam' | 'mateo'
const VIEWERS: { id: Viewer; label: string; full: string; sub: string }[] = [
  { id: 'jordan', label: 'Jordan', full: 'Jordan Lee', sub: 'Finance' },
  { id: 'ava', label: 'Ava', full: 'Ava Chen', sub: 'Design lead' },
  { id: 'sam', label: 'Sam', full: 'Sam Okafor', sub: 'Designer' },
  { id: 'mateo', label: 'Mateo', full: 'Mateo Ruiz', sub: 'Contractor' },
]
type Toast = { id: number; text: string; tone: 'good' | 'warn' | 'bad'; receipt?: string }

export default function App() {
  const [s, setS] = useState<State | null>(null)
  const [viewer, setViewer] = useState<Viewer>(() => (localStorage.getItem('tp-viewer') as Viewer) || 'jordan')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<any | null>(null)

  const refresh = useCallback(() => api.state(viewer).then((x) => { setS(x); setError(null) }).catch((e) => setError(e.message)), [viewer])
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t) }, [refresh])
  useEffect(() => { try { localStorage.setItem('tp-viewer', viewer) } catch { /* private mode */ } }, [viewer])

  const toast = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 6200)
  }
  const run = async <T,>(key: string, fn: () => Promise<T>, done: (r: T) => void = () => undefined) => {
    setBusy(key)
    try { done(await fn()) } catch (e: any) { toast({ text: e.message, tone: 'bad' }) } finally { setBusy(null); refresh() }
  }
  const openReceipt = (id: string) => run('receipt', () => api.receipt(id, viewer), setReceipt)

  if (!s && error) return <Shell><ErrorState text={error} retry={refresh} /></Shell>
  if (!s) return <Shell><Skeleton /></Shell>
  if (!s.seeded) return (
    <Shell compact>
      <div className="boot-card">
        <Mascot state="idle" />
        <h1>Work money, finally fun.</h1>
        <p>Set up Northwind Studio's team pots and perks.</p>
        <button className="btn primary" disabled={!!busy} onClick={() => run('setup', api.setup, () => toast({ text: 'Team pots are ready', tone: 'good' }))}>
          {busy ? 'Setting up…' : 'Set up team pots'}
        </button>
      </div>
    </Shell>
  )

  const ctx = { s, busy, run, toast, openReceipt }
  return (
    <Shell>
      <header className="top">
        <div className="brand"><Logo /><span className="co">{s.company.name}</span></div>
        <div className="viewas" role="tablist" aria-label="View as">
          <span className="viewas-label">View as</span>
          {VIEWERS.map((v) => (
            <button key={v.id} role="tab" aria-selected={viewer === v.id} className={viewer === v.id ? 'on' : ''} onClick={() => { setS(null); setViewer(v.id) }}>
              <Avatar name={v.full} small /> <span><b>{v.label}</b><small>{v.sub}</small></span>
            </button>
          ))}
        </div>
      </header>
      <main>
        {viewer === 'jordan' && <Finance {...ctx} viewer={viewer} />}
        {viewer === 'ava' && (s.people.find((p) => p.id === 'ava') ? <Lead {...ctx} me={s.people.find((p) => p.id === 'ava')!} /> : <Skeleton />)}
        {viewer === 'sam' && (s.people.find((p) => p.id === 'sam') ? <Employee {...ctx} me={s.people.find((p) => p.id === 'sam')!} /> : <Skeleton />)}
        {viewer === 'mateo' && (s.people.find((p) => p.id === 'mateo') ? <Contractor {...ctx} me={s.people.find((p) => p.id === 'mateo')!} /> : <Skeleton />)}
      </main>
      <footer className="foot">Demo company · test money · receipts open a public record</footer>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'warn' && <Mascot state="guarding" small />}<span>{t.text}</span>{t.receipt && <a href={t.receipt} target="_blank" rel="noreferrer">Receipt</a>}</div>)}
      </div>
      {receipt && <ReceiptSheet data={receipt} close={() => setReceipt(null)} />}
    </Shell>
  )
}

type Ctx = {
  s: State; busy: string | null
  run: <T>(key: string, fn: () => Promise<T>, done?: (r: T) => void) => Promise<void>
  toast: (t: Omit<Toast, 'id'>) => void
  openReceipt: (id: string) => void
}

type FinanceSection = 'overview' | 'payday' | 'pots' | 'people' | 'contractors' | 'quarter' | 'activity'
const FINANCE_TABS: { id: FinanceSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payday', label: 'Payday' },
  { id: 'pots', label: 'Pots & perks' },
  { id: 'people', label: 'People' },
  { id: 'contractors', label: 'Contractors' },
  { id: 'quarter', label: 'Quarter close' },
  { id: 'activity', label: 'Activity' },
]

function Finance({ s, busy, run, toast, openReceipt, viewer }: Ctx & { viewer: Viewer }) {
  const staff = s.people.filter((p) => p.salary)
  const payroll = staff.reduce((a, p) => a + (p.salary || 0), 0)
  const waiting = s.held.filter((h) => h.status === 'held')
  const openInv = s.invoices.filter((i) => i.status === 'submitted')
  const lastPayday = s.paydayRuns[0]
  const [section, setSection] = useState<FinanceSection>('overview')
  const [confirmPayday, setConfirmPayday] = useState(false)
  const [paydayParty, setPaydayParty] = useState<{ total: number; count: number; receipt?: string } | null>(null)
  const [nextDate, setNextDate] = useState(s.nextPayday)
  useEffect(() => setNextDate(s.nextPayday), [s.nextPayday])

  const paydayPanel = (
    <section className="card payday color-butter">
      <div className="card-h"><h2>Payday</h2>{lastPayday && <span className="muted">Last run {ago(lastPayday.at)}</span>}</div>
      <div className="date-row">
        <label>Next payday<input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>
        <button className="btn ghost" disabled={!!busy || nextDate === s.nextPayday} onClick={() => run('paydate', () => api.setPayday(nextDate), () => toast({ text: 'Next payday saved', tone: 'good' }))}>Save date</button>
      </div>
      <ul className="rows">
        {staff.map((p) => <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title}</small></span><span className="num">{money(p.salary!)}</span></li>)}
      </ul>
      <div className="card-f">
        <span className="muted">Preview first, then payday's in the pot.</span>
        <button className="btn primary" disabled={!!busy} onClick={() => setConfirmPayday(true)}>Preview payday</button>
      </div>
      {confirmPayday && <ConfirmSheet title="Run payday?" amount={money(payroll)} detail={`${staff.length} people · ${s.nextPayday}`} busy={busy === 'payday'} actionText="Run payday" onCancel={() => setConfirmPayday(false)} onConfirm={() => run('payday', api.payday, (r: any) => { setConfirmPayday(false); setPaydayParty({ total: r.total, count: r.count, receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }); toast({ text: `Payday's in the pot · ${r.count} people`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }) })} />}
    </section>
  )

  const content: Record<FinanceSection, ReactNode> = {
    overview: <div className="grid finance-grid">
      <section className="kpis span12">
        <Kpi label="Company balance" value={money(s.company.balance)} />
        <Kpi label="Monthly payroll" value={money(payroll)} sub={`${staff.length} people`} />
        <Kpi label="Waiting for approval" value={String(waiting.length)} tone={waiting.length ? 'warn' : undefined} />
        <Kpi label="Contractor invoices" value={String(openInv.length)} sub="to review" />
      </section>
      <section className="card span5 color-clay mascot-panel"><Mascot state={waiting.length ? 'guarding' : 'napping'} /><div><h2>{waiting.length ? 'Guarding the pot' : 'Nothing waiting'}</h2><p>{waiting.length ? 'A lead can approve, return, or add the vendor for next time.' : 'The pot is napping. Good sign.'}</p></div></section>
      <section className="card span7"><div className="card-h"><h2>Waiting for approval</h2><span className="pill">{waiting.length}</span></div><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={s.people.find((p) => p.role === 'admin')?.id ?? 'jordan'} /></section>
      <section className="card span7"><div className="card-h"><h2>Team pots</h2><span className="muted">Live team cards</span></div><div className="pots">{s.pots.map((pt) => <PotCard key={pt.id} s={s} potId={pt.id} />)}</div></section>
      <section className="card span5"><div className="card-h"><h2>Recent activity</h2></div><Feed s={s} compact openReceipt={openReceipt} /></section>
    </div>,
    payday: <div className="grid finance-grid"><section className="span7">{paydayPanel}</section><section className="card span5"><div className="card-h"><h2>Payday history</h2></div><ul className="rows">{s.paydayRuns.length ? s.paydayRuns.map((p) => <li key={p.id}><Mascot state="holding" small /><span className="grow"><b>{p.date}</b><small>{p.count} people · landed in {(p.ms / 1000).toFixed(1)}s</small></span><span className="num">{money(p.total)}</span></li>) : <li><Empty state="napping" text="No payday run yet." /></li>}</ul></section></div>,
    pots: <div className="grid finance-grid"><section className="card span7"><div className="card-h"><h2>Pots & perks</h2><span className="muted">Changing limits updates team cards</span></div><AdminTools mode="pots" s={s} busy={busy} run={run} toast={toast} /></section><section className="card span5 color-sage"><div className="card-h"><h2>Team pots</h2></div><div className="pots single">{s.pots.map((pt) => <PotCard key={pt.id} s={s} potId={pt.id} />)}</div></section></div>,
    people: <div className="grid finance-grid"><section className="card span5 color-butter"><div className="card-h"><h2>People</h2></div><AdminTools mode="people" s={s} busy={busy} run={run} toast={toast} /></section><section className="card span7"><div className="card-h"><h2>Directory</h2></div><ul className="rows">{s.people.filter((p) => p.role !== 'contractor').map((p) => <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title} · {p.team || 'Finance'}</small></span>{p.salary && <span className="num">{money(p.salary)}</span>}</li>)}</ul></section></div>,
    contractors: <div className="grid finance-grid"><section className="card span12"><div className="card-h"><h2>Contractors</h2><span className="pill">{openInv.length} to review</span></div><Invoices s={s} busy={busy} run={run} toast={toast} canPay /></section></div>,
    quarter: <div className="grid finance-grid"><section className="card span7 color-sage"><div className="card-h"><h2>Quarter close</h2><span className="muted">Savings become kudos</span></div><QuarterClose s={s} busy={busy} run={run} toast={toast} /></section><section className="card span5"><div className="card-h"><h2>Earned while unspent</h2><span className="pill">{s.simulatedEarnings.label}</span></div><b className="big-money">{money(s.simulatedEarnings.amount)}</b><p className="muted">{s.simulatedEarnings.note}</p></section></div>,
    activity: <div className="grid finance-grid"><section className="card span12"><div className="card-h"><h2>Activity</h2><a className="btn small ghost" href={api.activityCsv(viewer)}>Export CSV</a></div><Feed s={s} openReceipt={openReceipt} /></section></div>,
  }

  return (
    <div className="finance-shell">
      <nav className="finance-nav" aria-label="Finance sections">{FINANCE_TABS.map((t) => <button key={t.id} className={section === t.id ? 'on' : ''} onClick={() => setSection(t.id)}>{t.label}</button>)}</nav>
      <div className="finance-content">{content[section]}</div>
      <nav className="finance-tabs" aria-label="Finance sections">{FINANCE_TABS.map((t) => <button key={t.id} className={section === t.id ? 'on' : ''} onClick={() => setSection(t.id)}>{t.label}</button>)}</nav>
      {paydayParty && <PaydaySuccessSheet total={paydayParty.total} count={paydayParty.count} receipt={paydayParty.receipt} close={() => setPaydayParty(null)} />}
    </div>
  )
}

function Lead({ s, busy, run, toast, openReceipt, me }: Ctx & { me: Person }) {
  // A lead never approves their own request; those go to Finance.
  const waiting = s.held.filter((h) => h.status === 'held' && h.potId === me.team && h.personId !== me.id)
  return (
    <div className="grid">
      <section className="card span7"><div className="card-h"><h2>Your team's pot</h2></div><PotCard s={s} potId={me.team!} big /></section>
      <section className="card span5"><div className="card-h"><h2>Needs your OK</h2><span className="pill">{waiting.length}</span></div><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={me.id} /></section>
      <section className="span5"><Wallet s={s} me={me} busy={busy} run={run} toast={toast} /></section>
      <section className="card span7"><div className="card-h"><h2>Team activity</h2></div><Feed s={s} filter={(a) => a.potId === me.team} openReceipt={openReceipt} /></section>
      <section className="card span12"><div className="card-h"><h2>Kudos</h2></div><Kudos s={s} me={me} busy={busy} run={run} toast={toast} /></section>
    </div>
  )
}

function Employee({ s, busy, run, toast, openReceipt, me }: Ctx & { me: Person }) {
  const pay = s.paydayRuns[0]
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="hello hero-hello"><div><small>Good to see you</small><b>Hey, {me.name.split(' ')[0]}.</b><span>Your work money is ready to play nice.</span></div><Mascot state="idle" small /></div>
        <div className="payslip">
          <small>{pay ? `Payday landed · ${ago(pay.at)}` : `Next payday · ${s.nextPayday}`}</small>
          <b>{money(me.salary || 0)}</b>
          <span>Gross pay · current total {money(me.balance)}</span>
          {pay && <a href={`https://explore.testnet.tempo.xyz/tx/${pay.tx}`} target="_blank" rel="noreferrer">View payslip</a>}
        </div>
        <Wallet s={s} me={me} busy={busy} run={run} toast={toast} />
        <PerkCards s={s} me={me} busy={busy} run={run} toast={toast} />
        <div className="card flat"><div className="card-h"><h3>Recent</h3></div><Feed s={s} filter={(a) => a.who === me.id || a.kind === 'payday'} compact openReceipt={openReceipt} /></div>
      </div>
    </div>
  )
}

function Contractor({ s, busy, run, toast, me }: Ctx & { me: Person }) {
  const [amount, setAmount] = useState('1800')
  const [desc, setDesc] = useState('Q4 campaign illustrations')
  const mine = s.invoices.filter((i) => i.contractorId === me.id)
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="hello hero-hello contractor-hello"><div><small>{me.title} · {me.country}</small><b>Hi, {me.name.split(' ')[0]}.</b><span>Send the invoice. Get paid fast.</span></div><Mascot state="holding" small /></div>
        <div className="payslip"><small>Paid to you</small><b>{money(me.balance)}</b><span>Get paid the moment {s.company.name} approves</span></div>
        <form className="card flat form" onSubmit={(e) => { e.preventDefault(); run('inv', () => api.invoice({ contractorId: me.id, amount: Number(amount), description: desc }), () => toast({ text: 'Invoice sent', tone: 'good' })) }}>
          <h3>Send an invoice</h3>
          <label>What for<input value={desc} onChange={(e) => setDesc(e.target.value)} required /></label>
          <label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label>
          <button className="btn primary" disabled={!!busy || !Number(amount)}>{busy === 'inv' ? 'Sending…' : `Send invoice · ${money(Number(amount) || 0)}`}</button>
        </form>
        <div className="card flat"><div className="card-h"><h3>Your invoices</h3></div><Invoices s={s} busy={busy} run={run} toast={toast} items={mine} /></div>
      </div>
    </div>
  )
}

function Wallet({ s, me, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person }) {
  const pot = s.pots.find((p) => p.id === me.team)!
  const [vendorId, setVendorId] = useState(() => s.vendors.find((v) => pot.vendorIds.includes(v.id))?.id ?? s.vendors[0].id)
  const [amount, setAmount] = useState('45')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const left = me.pot?.left ?? 0
  const used = (me.pot?.cap ?? 0) - left
  const vendor = s.vendors.find((v) => v.id === vendorId)!
  const onList = pot.vendorIds.includes(vendorId)
  const viaDevice = !!me.hasPasskey && passkeysSupported()
  const spend = async () => {
    if (!viaDevice) return api.spend({ personId: me.id, vendorId, amount: Number(amount), note })
    const out = await payWithPasskey(me.id, vendorId, Number(amount), `${pot.id}:${note || vendor.category}`)
    return api.recordPasskey({ personId: me.id, vendorId, amount: Number(amount), note, ...('tx' in out ? { tx: out.tx } : { rejected: true }) })
  }
  const pay = () => run('spend', spend, (r: any) => {
    setConfirm(false)
    if (r.ok) toast({ text: `Paid ${vendor.name} ${money(Number(amount))} from the ${pot.team} pot`, tone: 'good', receipt: r.receipt })
    else toast({ text: r.held.reason === 'new-vendor' ? `Held for a sec · ${vendor.name} needs your lead's OK.` : `Held for a sec · that's over your monthly limit.`, tone: 'warn' })
  })
  return (
    <div className="card wallet">
      <div className="pot-head" style={{ ['--pot' as any]: pot.color }}>
        <small>{pot.team} pot · your share</small>
        <b>{money(Math.round(left))} <span>left this {pot.periodLabel}</span></b>
        <Bar used={used} cap={me.pot?.cap ?? 0} color={pot.color} />
        <small className="muted">{money(Math.round(used))} of {money(me.pot?.cap ?? 0)} used · resets {resetDate(me.pot?.resetsAt ?? null)}</small>
      </div>
      {passkeysSupported() && !me.hasPasskey && (
        <div className="enroll"><FaceIcon /><span className="grow"><b>Pay with Face ID</b><small>Your device becomes your team card.</small></span><button type="button" className="btn small primary" disabled={!!busy} onClick={() => run('enroll', () => enrollPasskey(me.id, me.name), () => toast({ text: 'Face ID is on. Payments now confirm on this device.', tone: 'good' }))}>{busy === 'enroll' ? 'Turning on…' : 'Turn on'}</button></div>
      )}
      {me.passkeyNeedsRefresh && <p className="hint">Your team list changed. Turn Face ID on again before the next device payment.</p>}
      <form className="form" onSubmit={(e) => { e.preventDefault(); setConfirm(true) }}>
        <label>Pay<select value={vendorId} onChange={(e) => setVendorId(e.target.value)}><optgroup label="Approved for your team">{s.vendors.filter((v) => pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup><optgroup label="Others (needs your lead's OK)">{s.vendors.filter((v) => !pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup></select></label>
        <div className="two"><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label><label>For<input placeholder={vendor.category} value={note} onChange={(e) => setNote(e.target.value)} maxLength={24} /></label></div>
        {!onList && <p className="hint">{vendor.name} isn't on the {pot.team} list. It'll wait for your lead's OK.</p>}
        <button className="btn primary" disabled={!!busy || !Number(amount)}>Pay {money(Number(amount) || 0)}</button>
      </form>
      {confirm && <ConfirmSheet title={`Pay ${vendor.name}?`} amount={money(Number(amount))} detail={`${pot.team} pot${note ? ` · ${note}` : ''}`} busy={busy === 'spend'} actionText={viaDevice ? 'Confirm with Face ID' : 'Confirm payment'} onCancel={() => setConfirm(false)} onConfirm={pay} face />}
    </div>
  )
}

function PerkCards({ s, me, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person }) {
  const perks = s.perks.filter((p) => p.personId === me.id)
  if (!perks.length) return null
  return <div className="perk-stack">{perks.map((p) => <PerkCard key={p.id} s={s} perk={p} me={me} busy={busy} run={run} toast={toast} />)}</div>
}
function PerkCard({ s, perk, me, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { perk: State['perks'][number]; me: Person }) {
  const [vendorId, setVendorId] = useState(perk.vendorIds[0])
  const [amount, setAmount] = useState(perk.periodLabel === 'day' ? '15' : '120')
  const vendor = s.vendors.find((v) => v.id === vendorId)!
  const left = perk.left ?? perk.cap
  return (
    <div className="card perk" style={{ ['--pot' as any]: perk.color }}>
      <div className="pot-head"><small>{perk.name} perk</small><b>{money(Math.round(left))} <span>left this {perk.periodLabel}</span></b><Bar used={perk.cap - left} cap={perk.cap} color={perk.color} /></div>
      <form className="form" onSubmit={(e) => { e.preventDefault(); run('perk' + perk.id, () => api.spend({ personId: me.id, vendorId, amount: Number(amount), note: perk.name, source: 'perk', perkId: perk.id }), (r: any) => toast({ text: `${perk.name} covered at ${vendor.name}`, tone: 'good', receipt: r.receipt })) }}>
        <div className="two"><label>Place<select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>{perk.vendorIds.map((id) => { const v = s.vendors.find((x) => x.id === id)!; return <option key={id} value={id}>{v.name}</option> })}</select></label><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label></div>
        <button className="btn primary" disabled={!!busy || !Number(amount)}>Use {perk.name}</button>
      </form>
    </div>
  )
}

function Approvals({ s, items, busy, run, toast, approverId }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { items: Held[]; approverId: string }) {
  if (!items.length) return <Empty state="napping" text="Nothing waiting. Nice." />
  return <div className="approval-stack"><div className="approval-guard"><Mascot state="guarding" small /><span>Held for approval</span></div><ul className="rows">{items.map((h) => {
    const p = s.people.find((x) => x.id === h.personId)!
    const v = s.vendors.find((x) => x.id === h.vendorId)!
    return (
      <li key={h.id} className="held">
        <Avatar name={p.name} />
        <span className="grow"><b>{p.name.split(' ')[0]} → {v.name} · {money(h.amount)}</b><small>{h.reason === 'new-vendor' ? `New vendor for ${s.pots.find((x) => x.id === h.potId)?.team}` : 'Over monthly limit'} · {h.note} · {ago(h.at)}</small></span>
        <button className="btn small ghost" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'return', approverId), () => toast({ text: 'Returned. Nothing was paid.', tone: 'good' }))}>Return</button>
        {h.reason === 'new-vendor' && <button className="btn small ghost" disabled={!!busy} onClick={() => run('a' + h.id, () => api.decide(h.id, 'approve-add', approverId), (r: any) => toast({ text: `Approved and added · ${v.name}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>Approve + add</button>}
        <button className="btn small primary" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'approve', approverId), (r: any) => toast({ text: `Approved · ${v.name} paid ${money(h.amount)}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>{busy === 'd' + h.id ? '…' : 'Approve'}</button>
      </li>
    )
  })}</ul></div>
}

function Invoices({ s, busy, run, toast, items, canPay }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { items?: Invoice[]; canPay?: boolean }) {
  const [decline, setDecline] = useState<string | null>(null)
  const [reason, setReason] = useState('Needs a revised scope')
  const list = items ?? s.invoices
  if (!list.length) return <Empty state="holding" text="No invoices yet." />
  return (
    <ul className="rows">
      {list.map((i) => {
        const c = s.people.find((x) => x.id === i.contractorId)!
        return (
          <li key={i.id}>
            <Avatar name={c.name} />
            <span className="grow"><b>{i.number} · {c.name}</b><small>{i.description} · {i.status === 'declined' ? `Declined: ${i.declineReason}` : c.country}</small></span>
            <span className="num">{money(i.amount)}</span>
            {i.status === 'paid'
              ? <span className="pill good">Paid{i.paidMs ? ` in ${(i.paidMs / 1000).toFixed(1)}s` : ''}</span>
              : i.status === 'declined'
                ? <span className="pill">Declined</span>
                : canPay
                  ? <><button className="btn small ghost" disabled={!!busy} onClick={() => setDecline(i.id)}>Decline</button><button className="btn small primary" disabled={!!busy} onClick={() => run('inv' + i.id, () => api.payInvoice(i.id), (r: any) => toast({ text: `${c.name.split(' ')[0]} paid ${money(i.amount)} · in ${((r.paidMs || 0) / 1000).toFixed(1)}s`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }))}>{busy === 'inv' + i.id ? 'Paying…' : 'Approve & pay'}</button></>
                  : <span className="pill">Waiting</span>}
            {decline === i.id && <ConfirmSheet title="Decline invoice?" amount={i.number} detail={<label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>} actionText="Decline" busy={busy === 'decline'} onCancel={() => setDecline(null)} onConfirm={() => run('decline', () => api.declineInvoice(i.id, reason), () => { setDecline(null); toast({ text: 'Invoice declined', tone: 'good' }) })} />}
          </li>
        )
      })}
    </ul>
  )
}

function PotCard({ s, potId, big }: { s: State; potId: string; big?: boolean }) {
  const pot = s.pots.find((p) => p.id === potId)!
  const members = s.people.filter((p) => p.team === potId)
  const cap = pot.perPersonCap * members.length
  const left = Math.max(0, members.reduce((a, m) => a + (m.pot?.left ?? 0), 0) - pot.approved)
  return (
    <div className={`pot ${big ? 'big' : ''}`} style={{ ['--pot' as any]: pot.color }}>
      <div className="pot-top"><b>{pot.team}</b><span className="muted">{money(Math.round(left))} left of {money(cap)} this {pot.periodLabel}</span></div>
      <Bar used={cap - left} cap={cap} color={pot.color} />
      <ul className="members">{members.map((m) => <li key={m.id}><Avatar name={m.name} small /><span className="grow">{m.name.split(' ')[0]}</span><span className="muted">{money(Math.round(m.pot?.left ?? 0))} / {money(pot.perPersonCap)}</span></li>)}</ul>
      {pot.approved > 0 && <small className="muted">Includes {money(pot.approved)} approved by the lead</small>}
      <div className="vendors">{pot.vendors.map((v) => <span key={v} className="chip">{v}</span>)}</div>
    </div>
  )
}

function QuarterClose({ s, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'>) {
  const [potId, setPotId] = useState(s.pots[0]?.id ?? '')
  const [share, setShare] = useState('20')
  const closes = s.quarterCloses
  const leaders = [...closes].sort((a, b) => b.savings - a.savings)
  return (
    <div className="split-block">
      <form className="form" onSubmit={(e) => { e.preventDefault(); run('close' + potId, () => api.closeQuarter(potId, Number(share)), (r: any) => toast({ text: `Quarter closed · ${money(r.pool)} kudos pool`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` })) }}>
        <div className="two"><label>Team<select value={potId} onChange={(e) => setPotId(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label><label>Savings share<input inputMode="numeric" value={share} onChange={(e) => setShare(e.target.value.replace(/[^\d.]/g, ''))} /></label></div>
        <button className="btn primary" disabled={!!busy}>Close quarter</button>
      </form>
      <div className="leaderboard">
        {leaders[0] && <div className="quarter-moment"><span className="burst" /><Mascot state="celebrating" small /><div><b>{money(leaders[0].pool)} kudos split</b><small>{money(leaders[0].perPerson, true)} each from {s.pots.find((p) => p.id === leaders[0].potId)?.team}</small></div></div>}
        {leaders.length ? leaders.map((c, i) => <div key={c.id} className="rank"><b>#{i + 1} {s.pots.find((p) => p.id === c.potId)?.team}</b><span>{money(c.savings)} saved</span></div>) : <Empty state="celebrating" text="Close a quarter to start the leaderboard." />}
      </div>
    </div>
  )
}

function Kudos({ s, me, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person }) {
  const mates = s.people.filter((p) => p.team === me.team && p.id !== me.id)
  const left = s.kudosCredits.filter((c) => c.personId === me.id).reduce((a, c) => a + c.left, 0)
  const [to, setTo] = useState(mates[0]?.id ?? '')
  const [amount, setAmount] = useState('5')
  const [note, setNote] = useState('Tiny miracle, huge help')
  if (!left) return <Empty state="celebrating" text="No kudos share yet. Close the quarter first." />
  return <form className="form compact-form" onSubmit={(e) => { e.preventDefault(); run('kudos', () => api.kudos({ fromPersonId: me.id, toPersonId: to, amount: Number(amount), note }), () => toast({ text: 'Kudos sent', tone: 'good' })) }}><span className="muted">{money(left, true)} left to award</span><div className="three"><label>Teammate<select value={to} onChange={(e) => setTo(e.target.value)}>{mates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Amount<div className="money-in"><span>$</span><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><label>Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label></div><button className="btn primary" disabled={!!busy || !to}>Send kudos</button></form>
}

function AdminTools({ s, busy, run, toast, mode = 'all' }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { mode?: 'all' | 'pots' | 'people' }) {
  const [vendorName, setVendorName] = useState('Canva')
  const [vendorCat, setVendorCat] = useState('Design')
  const [potId, setPotId] = useState(s.pots[0]?.id ?? '')
  const pot = s.pots.find((p) => p.id === potId) ?? s.pots[0]
  const [cap, setCap] = useState(String(pot?.perPersonCap ?? 0))
  const [vendorIds, setVendorIds] = useState<string[]>(pot?.vendorIds ?? [])
  const [personName, setPersonName] = useState('Nora Patel')
  const [personTitle, setPersonTitle] = useState('Brand Designer')
  const [personTeam, setPersonTeam] = useState(s.pots[0]?.id ?? '')
  const [perkPerson, setPerkPerson] = useState(s.people.find((p) => p.role !== 'contractor' && p.role !== 'admin')?.id ?? '')
  useEffect(() => { const p = s.pots.find((x) => x.id === potId); if (p) { setCap(String(p.perPersonCap)); setVendorIds(p.vendorIds) } }, [potId, s.pots])
  const toggleVendor = (id: string) => setVendorIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])
  return (
    <div className="admin-stack">
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('vendor', () => api.vendor({ name: vendorName, category: vendorCat }), () => toast({ text: 'Vendor added', tone: 'good' })) }}>
        <h3>Add vendor</h3><div className="two"><label>Name<input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></label><label>Category<input value={vendorCat} onChange={(e) => setVendorCat(e.target.value)} /></label></div><button className="btn ghost" disabled={!!busy}>Add vendor</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('pot', () => api.updatePot(potId, { perPersonCap: Number(cap), vendorIds }), (r: any) => toast({ text: `Updating team cards · ${r.reissued} refreshed`, tone: 'good' })) }}>
        <h3>Edit pot</h3><div className="two"><label>Pot<select value={potId} onChange={(e) => setPotId(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label><label>Monthly limit<div className="money-in"><span>$</span><input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ''))} /></div></label></div><div className="check-grid">{s.vendors.map((v) => <label key={v.id} className="check"><input type="checkbox" checked={vendorIds.includes(v.id)} onChange={() => toggleVendor(v.id)} />{v.name}</label>)}</div><button className="btn primary" disabled={!!busy}>Save pot</button>
      </form>}
      {mode !== 'pots' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('person', () => api.person({ name: personName, role: 'employee', title: personTitle, team: personTeam, salary: 3600 }), () => toast({ text: 'Person added', tone: 'good' })) }}>
        <h3>Add person</h3><div className="two"><label>Name<input value={personName} onChange={(e) => setPersonName(e.target.value)} /></label><label>Team<select value={personTeam} onChange={(e) => setPersonTeam(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label></div><label>Title<input value={personTitle} onChange={(e) => setPersonTitle(e.target.value)} /></label><button className="btn ghost" disabled={!!busy}>Add person</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); const ue = s.vendors.find((v) => v.name === 'Uber Eats')?.id ?? s.vendors[0].id; run('perk-new', () => api.perk({ personId: perkPerson, name: 'Snack dash', cap: 25, periodLabel: 'day', vendorIds: [ue] }), () => toast({ text: 'Perk added', tone: 'good' })) }}>
        <h3>Add perk</h3><label>Person<select value={perkPerson} onChange={(e) => setPerkPerson(e.target.value)}>{s.people.filter((p) => p.role !== 'contractor' && p.role !== 'admin').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn ghost" disabled={!!busy}>Add daily snack perk</button>
      </form>}
    </div>
  )
}

function Feed({ s, filter, compact, openReceipt }: { s: State; filter?: (a: Activity) => boolean; compact?: boolean; openReceipt: (id: string) => void }) {
  const items = useMemo(() => (filter ? s.activity.filter(filter) : s.activity).slice(0, compact ? 6 : 14), [s.activity, filter, compact])
  if (!items.length) return <Empty state="holding" text="Nothing yet." />
  return <ul className="feed">{items.map((a) => <li key={a.id} className={`k-${a.kind}`}><span className="dot" /><span className="grow"><b>{a.title}</b><small>{feedDetail(a)} · {ago(a.at)}</small></span>{a.amount !== undefined && <span className="num">{money(a.amount)}</span>}{a.receipt && <button className="rcpt" onClick={() => openReceipt(a.id)}>Receipt</button>}</li>)}</ul>
}

function feedDetail(a: Activity) {
  const memo = a.memoLabel || 'Teampot memo'
  if (a.detail.includes(memo) || memo.startsWith(a.detail)) return a.detail
  const memoLead = memo.split(' · ')[0]
  return a.detail.includes(memoLead) ? a.detail : `${a.detail} · ${memo}`
}

function ReceiptSheet({ data, close }: { data: any; close: () => void }) {
  return <div className="sheet" role="dialog" aria-modal="true" aria-label="Receipt detail"><div className="sheet-card receipt"><Mascot state="holding" /><small>{new Date(data.at).toLocaleString()}</small><b className="sheet-amt">{data.amount !== undefined ? money(data.amount) : 'Receipt'}</b><span>{data.title}</span><dl><dt>Who</dt><dd>{data.whoName || 'Northwind Studio'}</dd><dt>Pot</dt><dd>{data.potName || 'Company'}</dd><dt>Detail</dt><dd>{data.detail}</dd><dt>Memo</dt><dd>{data.memoLabel}</dd></dl>{data.publicRecord && <a className="btn primary" href={data.publicRecord} target="_blank" rel="noreferrer">View public record</a>}<button className="btn ghost" onClick={close}>Close</button></div></div>
}

function PaydaySuccessSheet({ total, count, receipt, close }: { total: number; count: number; receipt?: string; close: () => void }) {
  return <div className="sheet payday-party" role="dialog" aria-modal="true" aria-label="Payday success"><div className="sheet-card success-card"><Mascot state="cheering" /><small>{count} people paid</small><b className="sheet-amt"><CountMoney value={total} /></b><h2>Payday's in the pot.</h2>{receipt && <a className="btn primary" href={receipt} target="_blank" rel="noreferrer">Receipt</a>}<button className="btn ghost" onClick={close}>Done</button></div></div>
}

function CountMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      setShown(value * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{money(shown)}</>
}

function ConfirmSheet({ title, amount, detail, actionText, busy, onCancel, onConfirm, face }: { title: string; amount: string; detail: ReactNode; actionText: string; busy: boolean; onCancel: () => void; onConfirm: () => void; face?: boolean }) {
  return <div className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-card"><small>{title}</small><b className="sheet-amt">{amount}</b><div>{detail}</div><button className={face ? 'faceid' : 'btn primary'} disabled={busy} onClick={onConfirm}>{face && <FaceIcon />}{busy ? 'Working…' : actionText}</button><button className="btn ghost" onClick={onCancel}>Cancel</button></div></div>
}

const Bar = ({ used, cap, color }: { used: number; cap: number; color: string }) => <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.round(used)}><i style={{ width: `${cap ? Math.min(100, Math.max(0, (used / cap) * 100)) : 0}%`, background: color }} /></div>
const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) => <div className={`kpi ${tone || ''}`}><small>{label}</small><b>{value}</b>{sub && <span className="muted">{sub}</span>}</div>
const Empty = ({ text, state }: { text: string; state: 'idle' | 'cheering' | 'holding' | 'guarding' | 'napping' | 'celebrating' }) => <div className="empty"><Mascot state={state} small /><p>{text}</p></div>
const Avatar = ({ name, small }: { name: string; small?: boolean }) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className={`av ${small ? 'sm' : ''}`} style={{ background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 50% 30%)` }} aria-hidden>{name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
}
function Shell({ children, compact }: { children: ReactNode; compact?: boolean }) { return <div className={`app ${compact ? 'compact' : ''}`}>{children}</div> }
function Skeleton() { return <div className="grid skeleton"><section className="sk span12" /><section className="sk span7" /><section className="sk span5" /><section className="sk span6" /><section className="sk span6" /></div> }
function ErrorState({ text, retry }: { text: string; retry: () => void }) { return <div className="boot-card"><Mascot state="guarding" /><h1>Something needs a stir.</h1><p>{text}</p><button className="btn primary" onClick={retry}>Try again</button></div> }
const Logo = () => <span className="logo" aria-label="Teampot"><Mascot state="idle" tiny /><b>teamp<span>o</span>t</b></span>
function Mascot({ state, small, tiny }: { state: 'idle' | 'cheering' | 'holding' | 'guarding' | 'napping' | 'celebrating'; small?: boolean; tiny?: boolean }) {
  return (
    <svg className={`mascot ${state} ${small ? 'small' : ''} ${tiny ? 'tiny' : ''}`} viewBox="0 0 160 160" aria-hidden>
      <ellipse cx="80" cy="142" rx="38" ry="8" fill="#141414" opacity=".12" />
      <circle cx="80" cy="38" r="22" fill="#F6E6A5" stroke="#141414" strokeWidth="7" />
      <path d="M34 78c0-28 21-46 46-46s46 18 46 46c0 34-21 58-46 58S34 112 34 78Z" fill="#E8552D" stroke="#141414" strokeWidth="7" />
      <path d="M44 72h72" stroke="#B8401C" strokeWidth="7" strokeLinecap="round" />
      <circle cx="64" cy="86" r={state === 'napping' ? 2 : 4} fill="#141414" />
      <circle cx="96" cy="86" r={state === 'napping' ? 2 : 4} fill="#141414" />
      <path d={state === 'guarding' ? 'M67 106c7-5 19-5 26 0' : state === 'napping' ? 'M66 104h28' : 'M66 102c8 10 20 10 28 0'} stroke="#141414" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M50 134l-8 12M110 134l8 12" stroke="#141414" strokeWidth="7" strokeLinecap="round" />
      {state === 'cheering' || state === 'celebrating' ? <><path d="M33 75L17 58M127 75l16-17" stroke="#141414" strokeWidth="7" strokeLinecap="round" /><circle cx="23" cy="47" r="7" fill="#C8D69B" /><circle cx="137" cy="45" r="7" fill="#F6E6A5" /></> : null}
      {state === 'holding' ? <rect x="105" y="78" width="28" height="38" rx="4" fill="#fff" stroke="#141414" strokeWidth="5" /> : null}
      {state === 'guarding' ? <path d="M119 78l18 10-18 10-18-10z" fill="#C8D69B" stroke="#141414" strokeWidth="5" /> : null}
    </svg>
  )
}
const FaceIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1.2 4.5 1.2 6 0" /></svg>
