import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ago, money, resetDate, type Activity, type Held, type Invoice, type Person, type State, type StockId } from './api'
import { createInvitePasskey, enrollPasskey, passkeysSupported, payWithPasskey, signInPasskey } from './passkey'

type Viewer = 'jordan' | 'ava' | 'sam' | 'mateo'
const VIEWERS: { id: Viewer; label: string; full: string; sub: string }[] = [
  { id: 'jordan', label: 'Jordan', full: 'Jordan Lee', sub: 'Finance' },
  { id: 'ava', label: 'Ava', full: 'Ava Chen', sub: 'Design lead' },
  { id: 'sam', label: 'Sam', full: 'Sam Okafor', sub: 'Designer' },
  { id: 'mateo', label: 'Mateo', full: 'Mateo Ruiz', sub: 'Contractor' },
]
type Toast = { id: number; text: string; tone: 'good' | 'warn' | 'bad'; receipt?: string }

export default function App() {
  const [s, setS] = useState<State | null>(() => {
    try { return JSON.parse(localStorage.getItem('tp-state') || 'null') } catch { return null }
  })
  const [viewer, setViewer] = useState<Viewer>(() => (localStorage.getItem('tp-viewer') as Viewer) || 'jordan')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<any | null>(null)
  const [setupName, setSetupName] = useState('Northwind Studio')
  const inviteToken = useMemo(() => {
    const match = location.pathname.match(/^\/(?:app\/)?invite\/([^/]+)/)
    return match ? decodeURIComponent(match[1] || '') : ''
  }, [])

  const load = (x: State) => { setS(x); try { localStorage.setItem('tp-state', JSON.stringify(x)) } catch { /* private mode */ } setError(null) }
  // Ask who we are first, so a visitor without a session never triggers a failed (401) request.
  const refresh = useCallback(async () => {
    try {
      const me = await api.me()
      if (!me.signedIn) {
        if (inviteToken) return
        await api.demo(viewer)
      }
      load(await api.state())
    } catch (e: any) { setError(e.message) }
  }, [viewer, inviteToken])
  // Refresh every 8 s while the tab is visible; hidden tabs don't poll (keeps storage use low).
  useEffect(() => {
    if (inviteToken) return
    refresh()
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 8000)
    const onShow = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onShow)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow) }
  }, [refresh, inviteToken])
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
  const openReceipt = (id: string) => run('receipt', () => api.receipt(id), setReceipt)

  const switchDemo = (id: Viewer) => run('demo', () => api.demo(id), () => { setS(null); setViewer(id) })
  const realSignIn = (id: Viewer) => run('signin', async () => {
    const ch = await api.challenge(id)
    const signed = await signInPasskey(id, ch.challenge, ch.credentialId)
    return api.verify({ ...signed, challengeId: ch.id })
  }, () => toast({ text: 'Signed in with Face ID', tone: 'good' }))

  if (inviteToken) return <InviteAccept token={inviteToken} toast={toast} />
  if (!s && error) return <Shell><ErrorState text={error} retry={refresh} /></Shell>
  if (!s) return <Shell><Skeleton /></Shell>
  if (!s.seeded) return (
    <Shell compact>
      <div className="boot-card">
        <FillMark ratio={0.75} />
        <h1>Every team runs its own money.</h1>
        <p>Finance funds each department. Department heads set the spending frame.</p>
        <label className="setup-field">Company name<input value={setupName} onChange={(e) => setSetupName(e.target.value)} /></label>
        <button className="btn primary" disabled={!!busy} onClick={() => run('setup', () => api.setup({ companyName: setupName }), () => toast({ text: 'Departments are funded', tone: 'good' }))}>
          {busy ? 'Setting up...' : 'Fund departments'}
        </button>
      </div>
    </Shell>
  )

  const ctx = { s, busy, run, toast, openReceipt }
  return (
    <Shell>
      <header className="top">
        <div className="brand"><Logo /><span className="co">{s.company.name}</span></div>
        {s.auth?.demo && <span className="demo-chip">Demo</span>}
        <div className="viewas" role="tablist" aria-label="View as">
          <span className="viewas-label">Demo mode</span>
          {VIEWERS.map((v) => (
            <button key={v.id} role="tab" aria-selected={viewer === v.id} className={viewer === v.id ? 'on' : ''} onClick={() => switchDemo(v.id)}>
              <Avatar name={v.full} small /> <span><b>{v.label}</b><small>{v.sub}</small></span>
            </button>
          ))}
        </div>
        <button className="btn ghost" disabled={!!busy || s.auth?.demo === false} onClick={() => realSignIn(viewer)}>Sign in with Face ID</button>
      </header>
      <main>
        {viewer === 'jordan' && <Finance {...ctx} viewer={viewer} />}
        {viewer === 'ava' && (s.people.find((p) => p.id === 'ava') ? <Lead {...ctx} me={s.people.find((p) => p.id === 'ava')!} /> : <Skeleton />)}
        {viewer === 'sam' && (s.people.find((p) => p.id === 'sam') ? <Employee {...ctx} me={s.people.find((p) => p.id === 'sam')!} /> : <Skeleton />)}
        {viewer === 'mateo' && (s.people.find((p) => p.id === 'mateo') ? <Contractor {...ctx} me={s.people.find((p) => p.id === 'mateo')!} /> : <Skeleton />)}
      </main>
      <footer className="foot">{s.auth?.demo ? 'Demo company · ' : ''}test money · receipts open a public record</footer>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'warn' && <FillMark ratio={0.35} small />}<span>{t.text}</span>{t.receipt && <a href={t.receipt} target="_blank" rel="noreferrer">Receipt</a>}</div>)}
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
  { id: 'pots', label: 'Departments' },
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
        <span className="muted">Preview first. One batch pays everyone.</span>
        <button className="btn primary" disabled={!!busy} onClick={() => setConfirmPayday(true)}>Preview payday</button>
      </div>
      {confirmPayday && <ConfirmSheet title="Run payday?" amount={money(payroll)} detail={`${plural(staff.length, 'person', 'people')} · ${s.nextPayday}`} busy={busy === 'payday'} actionText="Run payday" onCancel={() => setConfirmPayday(false)} onConfirm={() => run('payday', api.payday, (r: any) => { setConfirmPayday(false); setPaydayParty({ total: r.total, count: r.count, receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }); toast({ text: `Payday complete · ${plural(r.count, 'person', 'people')}`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }) })} />}
    </section>
  )

  const content: Record<FinanceSection, ReactNode> = {
    overview: <div className="grid finance-grid">
      <section className="kpis span12">
        <Kpi label="Company balance" value={money(s.company.balance)} />
        <Kpi label="Monthly payroll" value={money(payroll)} sub={`${plural(staff.length, 'person', 'people')}`} />
        <Kpi label="Waiting for approval" value={String(waiting.length)} tone={waiting.length ? 'warn' : undefined} />
        <Kpi label="Contractor invoices" value={String(openInv.length)} sub="to review" />
      </section>
      <section className="card span12 org-panel"><div className="card-h"><h2>Company map</h2><span className="muted">Finance sets budgets. Departments decide.</span></div><OrgMap s={s} /></section>
      <section className="card span12"><div className="card-h"><h2>Waiting for approval</h2><span className="pill">{waiting.length}</span></div><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={s.people.find((p) => p.role === 'admin')?.id ?? 'jordan'} /></section>
      <section className="card span7"><div className="card-h"><h2>Departments</h2><span className="muted">Funded department accounts</span></div><div className="pots">{s.pots.map((pt) => <PotCard key={pt.id} s={s} potId={pt.id} />)}</div></section>
      <section className="card span5"><div className="card-h"><h2>Recent activity</h2></div><Feed s={s} compact openReceipt={openReceipt} /></section>
    </div>,
    payday: <div className="grid finance-grid"><section className="span7">{paydayPanel}</section><section className="card span5"><div className="card-h"><h2>Payday history</h2></div><ul className="rows">{s.paydayRuns.length ? s.paydayRuns.map((p) => <li key={p.id}><FillMark ratio={1} small /><span className="grow"><b>{p.date}</b><small>{plural(p.count, 'person', 'people')} · landed in {(p.ms / 1000).toFixed(1)}s</small></span><span className="num">{money(p.total)}</span></li>) : <li><Empty text="No payday run yet." /></li>}</ul></section></div>,
    pots: <div className="grid finance-grid"><section className="card span7"><div className="card-h"><h2>Departments & perks</h2><span className="muted">Changing limits updates department cards</span></div><AdminTools mode="pots" s={s} busy={busy} run={run} toast={toast} /></section><section className="card span5 color-sage"><div className="card-h"><h2>Departments</h2></div><div className="pots single">{s.pots.map((pt) => <PotCard key={pt.id} s={s} potId={pt.id} />)}</div></section></div>,
    people: <div className="grid finance-grid"><section className="card span5 color-butter"><div className="card-h"><h2>People</h2></div><AdminTools mode="people" s={s} busy={busy} run={run} toast={toast} /></section><section className="card span7"><div className="card-h"><h2>Directory</h2></div><ul className="rows">{s.people.filter((p) => p.role !== 'contractor').map((p) => <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title} · {p.team || 'Finance'}</small></span>{p.salary && <span className="num">{money(p.salary)}</span>}{p.role !== 'admin' && <button className="btn small ghost" disabled={!!busy} onClick={() => run('remove' + p.id, () => api.removePerson(p.id), () => toast({ text: `${p.name.split(' ')[0]} removed`, tone: 'good' }))}>Remove</button>}</li>)}</ul></section></div>,
    contractors: <div className="grid finance-grid"><section className="card span12"><div className="card-h"><h2>Contractors</h2><span className="pill">{openInv.length} to review</span></div><Invoices s={s} busy={busy} run={run} toast={toast} canPay /></section></div>,
    quarter: <div className="grid finance-grid"><section className="card span7 color-sage"><div className="card-h"><h2>Quarter close</h2><span className="muted">Savings become kudos</span></div><QuarterClose s={s} busy={busy} run={run} toast={toast} /></section><section className="card span5"><div className="card-h"><h2>Earned while unspent</h2><span className="pill">{s.simulatedEarnings.label}</span></div><b className="big-money">{money(s.simulatedEarnings.amount)}</b><p className="muted">{s.simulatedEarnings.note}</p></section></div>,
    activity: <div className="grid finance-grid"><section className="card span12"><div className="card-h"><h2>Activity</h2><a className="btn small ghost" href={api.activityCsv()}>Export CSV</a></div><Feed s={s} openReceipt={openReceipt} /></section></div>,
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
      <section className="card span12 org-panel"><div className="card-h"><h2>Company map</h2><span className="muted">Your department, inside the company frame</span></div><OrgMap s={s} activePotId={me.team} /></section>
      <section className="card span7"><div className="card-h"><h2>Your department</h2></div><PotCard s={s} potId={me.team!} big /></section>
      <section className="card span5"><div className="card-h"><h2>Needs your OK</h2><span className="pill">{waiting.length}</span></div><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={me.id} /></section>
      <section className="card span12"><div className="card-h"><h2>Department settings</h2><a className="btn small ghost" href={api.activityCsv()}>Export activity</a></div><AdminTools s={s} busy={busy} run={run} toast={toast} /></section>
      <section className="span5"><Wallet s={s} me={me} busy={busy} run={run} toast={toast} /></section>
      <section className="card span7"><div className="card-h"><h2>Department activity</h2></div><Feed s={s} filter={(a) => a.potId === me.team} openReceipt={openReceipt} /></section>
      <section className="card span12"><div className="card-h"><h2>Kudos</h2></div><Kudos s={s} me={me} busy={busy} run={run} toast={toast} /></section>
    </div>
  )
}

function Employee({ s, busy, run, toast, openReceipt, me }: Ctx & { me: Person }) {
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="hello hero-hello"><div><small>Money home</small><b>Hey, {me.name.split(' ')[0]}.</b><span>Your pay can stay, earn, or become shares.</span></div><FillMark ratio={0.7} small /></div>
        <MoneyHome s={s} me={me} busy={busy} run={run} toast={toast} openReceipt={openReceipt} showSpend />
        <PerkCards s={s} me={me} busy={busy} run={run} toast={toast} />
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
        <div className="hello hero-hello contractor-hello"><div><small>{me.title} · {me.country}</small><b>Hi, {me.name.split(' ')[0]}.</b><span>Send the invoice. Get paid fast.</span></div><FillMark ratio={0.45} small /></div>
        <MoneyHome s={s} me={me} busy={busy} run={run} toast={toast} openReceipt={() => undefined} />
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

function MoneyHome({ s, me, busy, run, toast, openReceipt, showSpend }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast' | 'openReceipt'> & { me: Person; showSpend?: boolean }) {
  const pay = s.paydayRuns[0]
  const inv = s.investments.find((x) => x.personId === me.id)
  const earned = s.earnEntries.find((x) => x.personId === me.id)
  const invested = inv?.positions.reduce((a, p) => a + p.value, 0) ?? 0
  const earning = earned?.balance ?? 0
  const total = me.balance + invested + earning
  return (
    <div className="money-home">
      <section className="money-total">
        <small>Total balance</small>
        <b>{money(total)}</b>
        <span>{pay ? `Last payday · ${ago(pay.at)}` : `Next payday · ${s.nextPayday}`}</span>
      </section>
      <section className="money-split">
        <div><small>Keep</small><b>{money(me.balance)}</b></div>
        <div><small>{s.earnEntries?.find((e) => e.personId === me.id)?.mode === 'real' ? 'Earning' : 'Earning · illustrative'}</small><b>{money(earning)}</b></div>
        <div><small>Invest</small><b>{money(invested)}</b></div>
      </section>
      {showSpend && <Wallet s={s} me={me} busy={busy} run={run} toast={toast} />}
      <KeepCard s={s} me={me} pay={pay} />
      <EarnCard s={s} me={me} entry={earned} busy={busy} run={run} toast={toast} />
      <InvestCard s={s} me={me} inv={inv} busy={busy} run={run} toast={toast} />
      <div className="card flat"><div className="card-h"><h3>Recent activity</h3></div><Feed s={s} filter={(a) => a.who === me.id || a.kind === 'payday'} compact openReceipt={openReceipt} /></div>
    </div>
  )
}

function KeepCard({ s, me, pay }: { s: State; me: Person; pay?: State['paydayRuns'][number] }) {
  return (
    <section className="card flat keep-card">
      <div className="card-h"><h3>Keep</h3><span className="pill">Cash</span></div>
      <b className="big-money">{money(me.balance)}</b>
      <p className="muted">{pay ? `${money(me.salary || 0)} gross landed in ${(pay.ms / 1000).toFixed(1)}s.` : `Next payday is ${s.nextPayday}.`}</p>
      {pay && <a href={`https://explore.testnet.tempo.xyz/tx/${pay.tx}`} target="_blank" rel="noreferrer">View payslip</a>}
    </section>
  )
}

function EarnCard({ me, entry, busy, run, toast }: Pick<Ctx, 'busy' | 'run' | 'toast'> & { s: State; me: Person; entry?: State['earnEntries'][number] }) {
  const [amount, setAmount] = useState('100')
  return (
    <section className="card flat earn-card">
      <div className="card-h"><h3>Earning</h3><span className="pill">{entry?.mode === 'real' ? 'Live' : 'Simulated'}</span></div>
      <b className="big-money">{money(entry?.balance ?? 0)}</b>
      <p className="muted">{entry?.mode === 'real' ? 'Your idle cash is earning and stays spendable.' : "Illustrative for now: earning goes live when Tempo's earning vaults open on the test network."}</p>
      <form className="form compact-form" onSubmit={(e) => { e.preventDefault(); run('earn', () => api.earnDeposit({ personId: me.id, amount: Number(amount) }), (r: any) => toast({ text: r.mode === 'real' ? 'Earning deposit confirmed' : 'Earning is simulated for now', tone: r.mode === 'real' ? 'good' : 'warn' })) }}>
        <label>Move idle cash<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>
        <button className="btn ghost" disabled={!!busy || !Number(amount)}>Move to Earning</button>
      </form>
    </section>
  )
}

function InvestCard({ s, me, inv, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person; inv?: State['investments'][number] }) {
  const [stockId, setStockId] = useState<StockId>(inv?.election?.stockId ?? 'aapl')
  const [percent, setPercent] = useState(String(inv?.election?.percent ?? 20))
  const [cash, setCash] = useState('100')
  const [sellStock, setSellStock] = useState<StockId>((inv?.positions[0]?.stockId as StockId | undefined) ?? 'aapl')
  const [sellShares, setSellShares] = useState('0.25')
  const selected = s.stocks.find((x) => x.id === stockId) ?? s.stocks[0]
  const delayed = selected?.delayed ? 'delayed' : 'current'
  return (
    <section className="card flat invest-card">
      <div className="card-h"><h3>Invest</h3><span className="pill">{delayed} prices</span></div>
      <form className="form compact-form" onSubmit={(e) => { e.preventDefault(); run('election', () => api.election({ personId: me.id, stockId, percent: Number(percent) }), () => toast({ text: 'Payday investing saved', tone: 'good' })) }}>
        <div className="two"><label>Share of each payday<div className="money-in"><input inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ''))} /><span style={{ paddingRight: 12 }}>%</span></div></label><label>Stock<select value={stockId} onChange={(e) => setStockId(e.target.value as StockId)}>{s.stocks.map((st) => <option key={st.id} value={st.id}>{st.display}</option>)}</select></label></div>
        <button className="btn ghost" disabled={!!busy}>Save payday split</button>
      </form>
      <div className="stock-list">
        {inv?.positions.length ? inv.positions.map((p) => {
          const st = s.stocks.find((x) => x.id === p.stockId)!
          return <div key={p.stockId} className="stock-row"><span><b>{st.display}</b><small>{p.shares} shares · avg {money(p.avgCost, true)}</small></span><span className="num">{money(p.value, true)}<small className={p.gain >= 0 ? 'gain' : 'loss'}>{p.gain >= 0 ? '+' : ''}{money(p.gain, true)}</small></span></div>
        }) : <Empty text="No shares yet." />}
      </div>
      <form className="form compact-form trade-form" onSubmit={(e) => { e.preventDefault(); run('trade-buy', () => api.trade({ personId: me.id, stockId, side: 'buy', cashAmount: Number(cash) }), (r: any) => toast({ text: `Bought ${r.shares} shares`, tone: 'good', receipt: r.receipt })) }}>
        <div className="two"><label>Buy<select value={stockId} onChange={(e) => setStockId(e.target.value as StockId)}>{s.stocks.map((st) => <option key={st.id} value={st.id}>{st.display} · {money(st.lastPrice, true)}</option>)}</select></label><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))} /></div></label></div>
        <button className="btn primary" disabled={!!busy || !Number(cash)}>Buy</button>
      </form>
      <form className="form compact-form trade-form" onSubmit={(e) => { e.preventDefault(); run('trade-sell', () => api.trade({ personId: me.id, stockId: sellStock, side: 'sell', shares: Number(sellShares) }), (r: any) => toast({ text: `Sold ${r.shares} shares`, tone: 'good', receipt: r.receipt })) }}>
        <div className="two"><label>Sell<select value={sellStock} onChange={(e) => setSellStock(e.target.value as StockId)}>{(inv?.positions.length ? inv.positions : s.stocks.map((st) => ({ stockId: st.id }))).map((p: any) => { const st = s.stocks.find((x) => x.id === p.stockId)!; return <option key={st.id} value={st.id}>{st.display}</option> })}</select></label><label>Shares<input inputMode="decimal" value={sellShares} onChange={(e) => setSellShares(e.target.value.replace(/[^\d.]/g, ''))} /></label></div>
        <button className="btn ghost" disabled={!!busy || !Number(sellShares)}>Sell</button>
      </form>
    </section>
  )
}

function InviteAccept({ token, toast }: { token: string; toast: (t: Omit<Toast, 'id'>) => void }) {
  const [info, setInfo] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.inviteInfo(token).then(setInfo).catch((e) => setError(e.message)) }, [token])
  const accept = async () => {
    if (!info) return
    setBusy(true)
    try {
      const cred = await createInvitePasskey(info.person.name)
      await api.acceptInvite(token, { id: cred.id, publicKey: cred.publicKey as `0x${string}` })
      toast({ text: 'Face ID is set up', tone: 'good' })
      location.href = '/app'
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell compact>
      <div className="boot-card">
        <FillMark ratio={0.8} />
        <h1>{info ? `Join ${info.person.team}.` : 'Opening invite.'}</h1>
        <p>{error || (info ? `${info.person.name} · ${info.person.title}` : 'Checking this link.')}</p>
        {info && <button className="btn primary" disabled={busy || !passkeysSupported()} onClick={accept}>{busy ? 'Setting up...' : 'Set up Face ID'}</button>}
      </div>
    </Shell>
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
    if (r.ok) toast({ text: `Paid ${vendor.name} ${money(Number(amount))} from ${pot.team}`, tone: 'good', receipt: r.receipt })
    else toast({ text: r.held.reason === 'new-vendor' ? `Held for a sec · ${vendor.name} needs your lead's OK.` : `Held for a sec · that's over your monthly limit.`, tone: 'warn' })
  })
  return (
    <div className="card wallet">
      <div className="pot-head" style={{ ['--pot' as any]: pot.color }}>
        <small>{pot.team} · your share</small>
        <b>{money(Math.round(left))} <span>left this {pot.periodLabel}</span></b>
        <Bar used={used} cap={me.pot?.cap ?? 0} color={pot.color} />
        <small className="muted">{money(Math.round(used))} of {money(me.pot?.cap ?? 0)} used · resets {resetDate(me.pot?.resetsAt ?? null)}</small>
      </div>
      {passkeysSupported() && !me.hasPasskey && (
        <div className="enroll"><FaceIcon /><span className="grow"><b>Pay with Face ID</b><small>Your device becomes your department card.</small></span><button type="button" className="btn small primary" disabled={!!busy} onClick={() => run('enroll', () => enrollPasskey(me.id, me.name), () => toast({ text: 'Face ID is on. Payments now confirm on this device.', tone: 'good' }))}>{busy === 'enroll' ? 'Turning on...' : 'Turn on'}</button></div>
      )}
      {me.passkeyNeedsRefresh && <p className="hint">Your department list changed. Turn Face ID on again before the next device payment.</p>}
      <form className="form" onSubmit={(e) => { e.preventDefault(); setConfirm(true) }}>
        <label>Pay<select value={vendorId} onChange={(e) => setVendorId(e.target.value)}><optgroup label="Approved for your department">{s.vendors.filter((v) => pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup><optgroup label="Others (needs your lead's OK)">{s.vendors.filter((v) => !pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup></select></label>
        <div className="two"><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label><label>For<input placeholder={vendor.category} value={note} onChange={(e) => setNote(e.target.value)} maxLength={24} /></label></div>
        {!onList && <p className="hint">{vendor.name} isn't on the {pot.team} list. It will wait for your lead's OK.</p>}
        <button className="btn primary" disabled={!!busy || !Number(amount)}>Pay {money(Number(amount) || 0)}</button>
      </form>
      {confirm && <ConfirmSheet title={`Pay ${vendor.name}?`} amount={money(Number(amount))} detail={`${pot.team}${note ? ` · ${note}` : ''}`} busy={busy === 'spend'} actionText={viaDevice ? 'Confirm with Face ID' : 'Confirm payment'} onCancel={() => setConfirm(false)} onConfirm={pay} face />}
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
  if (!items.length) return <Empty text="Nothing waiting. Nice." />
  return <div className="approval-stack"><div className="approval-guard"><FillMark ratio={0.8} small /><span>Held for approval</span></div><ul className="rows">{items.map((h) => {
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
  if (!list.length) return <Empty text="No invoices yet." />
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
  const budgetRatio = pot.budget ? Math.max(0, Math.min(1, pot.balance / pot.budget)) : 0
  return (
    <div className={`pot ${big ? 'big' : ''}`} style={{ ['--pot' as any]: pot.color }}>
      <div className="pot-top"><b>{pot.team}</b><span className="muted">{money(Math.round(pot.balance))} funded · {money(Math.round(left))} member room</span></div>
      <FillMark ratio={budgetRatio} color={pot.color} small />
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
        <div className="two"><label>Department<select value={potId} onChange={(e) => setPotId(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label><label>Savings share<input inputMode="numeric" value={share} onChange={(e) => setShare(e.target.value.replace(/[^\d.]/g, ''))} /></label></div>
        <button className="btn primary" disabled={!!busy}>Close quarter</button>
      </form>
      <div className="leaderboard">
        {leaders[0] && <div className="quarter-moment"><span className="burst" /><FillMark ratio={1} small /><div><b>{money(leaders[0].pool)} kudos split</b><small>{money(leaders[0].perPerson, true)} each from {s.pots.find((p) => p.id === leaders[0].potId)?.team}</small></div></div>}
        {leaders.length ? leaders.map((c, i) => <div key={c.id} className="rank"><b>#{i + 1} {s.pots.find((p) => p.id === c.potId)?.team}</b><span>{money(c.savings)} saved</span></div>) : <Empty text="Close a quarter to start the leaderboard." />}
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
  if (!left) return <Empty text="No kudos share yet. Close the quarter first." />
  return <form className="form compact-form" onSubmit={(e) => { e.preventDefault(); run('kudos', () => api.kudos({ fromPersonId: me.id, toPersonId: to, amount: Number(amount), note }), () => toast({ text: 'Kudos sent', tone: 'good' })) }}><span className="muted">{money(left, true)} left to award</span><div className="three"><label>Teammate<select value={to} onChange={(e) => setTo(e.target.value)}>{mates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Amount<div className="money-in"><span>$</span><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><label>Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label></div><button className="btn primary" disabled={!!busy || !to}>Send kudos</button></form>
}

function AdminTools({ s, busy, run, toast, mode = 'all' }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { mode?: 'all' | 'pots' | 'people' }) {
  const [vendorName, setVendorName] = useState('Canva')
  const [vendorCat, setVendorCat] = useState('Design')
  const [potId, setPotId] = useState(s.pots[0]?.id ?? '')
  const pot = s.pots.find((p) => p.id === potId) ?? s.pots[0]
  const [cap, setCap] = useState(String(pot?.perPersonCap ?? 0))
  const [budget, setBudget] = useState(String(pot?.budget ?? 0))
  const [threshold, setThreshold] = useState(String(s.company.financeApprovalThreshold ?? 1000))
  const [moveAmount, setMoveAmount] = useState('250')
  const [vendorIds, setVendorIds] = useState<string[]>(pot?.vendorIds ?? [])
  const [personName, setPersonName] = useState('Nora Patel')
  const [personTitle, setPersonTitle] = useState('Brand Designer')
  const [personTeam, setPersonTeam] = useState(s.pots[0]?.id ?? '')
  const [inviteLink, setInviteLink] = useState('')
  const [perkPerson, setPerkPerson] = useState(s.people.find((p) => p.role !== 'contractor' && p.role !== 'admin')?.id ?? '')
  useEffect(() => { const p = s.pots.find((x) => x.id === potId); if (p) { setCap(String(p.perPersonCap)); setBudget(String(p.budget)); setVendorIds(p.vendorIds) } }, [potId, s.pots])
  const toggleVendor = (id: string) => setVendorIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])
  return (
    <div className="admin-stack">
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('vendor', () => api.vendor({ name: vendorName, category: vendorCat }), () => toast({ text: 'Vendor added', tone: 'good' })) }}>
        <h3>Add vendor</h3><div className="two"><label>Name<input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></label><label>Category<input value={vendorCat} onChange={(e) => setVendorCat(e.target.value)} /></label></div><button className="btn ghost" disabled={!!busy}>Add vendor</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('pot', () => api.updatePot(potId, { perPersonCap: Number(cap), budget: Number(budget), vendorIds }), (r: any) => toast({ text: `Updating department cards · ${r.reissued} refreshed`, tone: 'good' })) }}>
        <h3>Edit department</h3><div className="two"><label>Department<select value={potId} onChange={(e) => setPotId(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label><label>Member limit<div className="money-in"><span>$</span><input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ''))} /></div></label></div><label>Budget frame<div className="money-in"><span>$</span><input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><div className="check-grid">{s.vendors.map((v) => <label key={v.id} className="check"><input type="checkbox" checked={vendorIds.includes(v.id)} onChange={() => toggleVendor(v.id)} />{v.name}</label>)}</div><button className="btn primary" disabled={!!busy}>Save department</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('rule', () => api.financeRule(Number(threshold)), () => toast({ text: 'Finance rule saved', tone: 'good' })) }}>
        <h3>Finance rule</h3><label>Finance reviews payments over<div className="money-in"><span>$</span><input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><button className="btn ghost" disabled={!!busy || !Number(threshold)}>Save rule</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => e.preventDefault()}>
        <h3>Move budget</h3><div className="two"><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><label>Department<select value={potId} onChange={(e) => setPotId(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label></div>
        <div className="two"><button type="button" className="btn ghost" disabled={!!busy || !Number(moveAmount)} onClick={() => run('fund' + potId, () => s.auth?.role === 'admin' ? api.fundPot(potId, Number(moveAmount)) : api.topupRequest(potId, Number(moveAmount)), (r: any) => toast({ text: s.auth?.role === 'admin' ? `Funded ${s.pots.find((p) => p.id === potId)?.team}` : 'Top-up sent to Finance', tone: 'good', receipt: r.receipt }))}>{s.auth?.role === 'admin' ? 'Fund' : 'Request top-up'}</button><button type="button" className="btn ghost" disabled={!!busy || !Number(moveAmount)} onClick={() => run('return' + potId, () => api.returnPot(potId, Number(moveAmount)), (r: any) => toast({ text: `Returned from ${s.pots.find((p) => p.id === potId)?.team}`, tone: 'good', receipt: r.receipt }))}>Return</button></div>
      </form>}
      {mode !== 'pots' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); run('invite', () => api.invite({ name: personName, role: 'employee', title: personTitle, team: personTeam, salary: 3600 }), (r: any) => { setInviteLink(`${location.origin}${r.inviteLink}`); toast({ text: 'Invite link ready', tone: 'good' }) }) }}>
        <h3>Invite person</h3><div className="two"><label>Name<input value={personName} onChange={(e) => setPersonName(e.target.value)} /></label><label>Department<select value={personTeam} onChange={(e) => setPersonTeam(e.target.value)}>{s.pots.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label></div><label>Title<input value={personTitle} onChange={(e) => setPersonTitle(e.target.value)} /></label>{inviteLink && <p className="hint">{inviteLink}</p>}<button className="btn ghost" disabled={!!busy}>Create invite</button>
      </form>}
      {mode !== 'people' && <form className="form mini" onSubmit={(e) => { e.preventDefault(); const ue = s.vendors.find((v) => v.name === 'Uber Eats')?.id ?? s.vendors[0].id; run('perk-new', () => api.perk({ personId: perkPerson, name: 'Snack dash', cap: 25, periodLabel: 'day', vendorIds: [ue] }), () => toast({ text: 'Perk added', tone: 'good' })) }}>
        <h3>Add perk</h3><label>Person<select value={perkPerson} onChange={(e) => setPerkPerson(e.target.value)}>{s.people.filter((p) => p.role !== 'contractor' && p.role !== 'admin').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn ghost" disabled={!!busy}>Add daily snack perk</button>
      </form>}
    </div>
  )
}

function Feed({ s, filter, compact, openReceipt }: { s: State; filter?: (a: Activity) => boolean; compact?: boolean; openReceipt: (id: string) => void }) {
  const items = useMemo(() => (filter ? s.activity.filter(filter) : s.activity).slice(0, compact ? 6 : 14), [s.activity, filter, compact])
  if (!items.length) return <Empty text="Nothing yet." />
  return <ul className="feed">{items.map((a) => <li key={a.id} className={`k-${a.kind}`}><span className="dot" /><span className="grow"><b>{a.title}</b><small>{feedDetail(a)} · {ago(a.at)}</small></span>{a.amount !== undefined && <span className="num">{money(a.amount)}</span>}{a.receipt && <button className="rcpt" onClick={() => openReceipt(a.id)}>Receipt</button>}</li>)}</ul>
}

function feedDetail(a: Activity) {
  const memo = a.memoLabel || 'Teampot memo'
  if (a.detail.includes(memo) || memo.startsWith(a.detail)) return a.detail
  const memoLead = memo.split(' · ')[0]
  return a.detail.includes(memoLead) ? a.detail : `${a.detail} · ${memo}`
}

function ReceiptSheet({ data, close }: { data: any; close: () => void }) {
  return <div className="sheet" role="dialog" aria-modal="true" aria-label="Receipt detail"><div className="sheet-card receipt"><FillMark ratio={0.65} /><small>{new Date(data.at).toLocaleString()}</small><b className="sheet-amt">{data.amount !== undefined ? money(data.amount) : 'Receipt'}</b><span>{data.title}</span><dl><dt>Who</dt><dd>{data.whoName || 'Northwind Studio'}</dd><dt>Pot</dt><dd>{data.potName || 'Company'}</dd><dt>Detail</dt><dd>{data.detail}</dd><dt>Memo</dt><dd>{data.memoLabel}</dd></dl>{data.publicRecord && <a className="btn primary" href={data.publicRecord} target="_blank" rel="noreferrer">View public record</a>}<button className="btn ghost" onClick={close}>Close</button></div></div>
}

function PaydaySuccessSheet({ total, count, receipt, close }: { total: number; count: number; receipt?: string; close: () => void }) {
  return <div className="sheet payday-party" role="dialog" aria-modal="true" aria-label="Payday success"><div className="sheet-card success-card"><FillMark ratio={1} /><small>{plural(count, 'person', 'people')} paid</small><b className="sheet-amt"><CountMoney value={total} /></b><h2>Payday complete.</h2>{receipt && <a className="btn primary" href={receipt} target="_blank" rel="noreferrer">Receipt</a>}<button className="btn ghost" onClick={close}>Done</button></div></div>
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const Bar = ({ used, cap, color }: { used: number; cap: number; color: string }) => <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.round(used)}><i style={{ width: `${cap ? Math.min(100, Math.max(0, (used / cap) * 100)) : 0}%`, background: color }} /></div>
const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) => <div className={`kpi ${tone || ''}`}><small>{label}</small><b>{value}</b>{sub && <span className="muted">{sub}</span>}</div>
function OrgMap({ s, activePotId }: { s: State; activePotId?: string }) {
  return (
    <div className="org-map" aria-label="Company organization map">
      <div className="org-company">
        <FillMark ratio={0.9} />
        <div><b>{s.company.name}</b><small>{activePotId ? 'Finance sets the frame' : `Company account · ${money(s.company.balance)}`}</small></div>
      </div>
      <div className="org-lines" />
      <div className="org-depts">
        {s.pots.map((p) => {
          const ratio = p.budget ? Math.max(0, Math.min(1, p.balance / p.budget)) : 0
          const people = s.people.filter((x) => x.team === p.id)
          const waiting = s.held.filter((h) => h.potId === p.id && h.status === 'held').length
          return (
            <button key={p.id} className={`org-node ${activePotId === p.id ? 'active' : ''} ${waiting ? 'waiting' : ''}`} type="button">
              <FillMark ratio={ratio} color={p.color} small />
              <span className="grow"><b>{p.team}</b><small>{money(Math.round(p.balance))} left · {plural(people.length, 'person', 'people')}</small></span>
              {waiting > 0 && <span className="pill">{waiting}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
const Empty = ({ text }: { text: string }) => <div className="empty"><FillMark ratio={0.2} small /><p>{text}</p></div>
const Avatar = ({ name, small }: { name: string; small?: boolean }) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className={`av ${small ? 'sm' : ''}`} style={{ background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 50% 30%)` }} aria-hidden>{name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
}
function Shell({ children, compact }: { children: ReactNode; compact?: boolean }) { return <div className={`app ${compact ? 'compact' : ''}`}>{children}</div> }
function Skeleton() { return <div className="grid skeleton"><section className="sk span12" /><section className="sk span7" /><section className="sk span5" /><section className="sk span6" /><section className="sk span6" /></div> }
function ErrorState({ text, retry }: { text: string; retry: () => void }) { return <div className="boot-card"><FillMark ratio={0.5} /><h1>Something needs attention.</h1><p>{text}</p><button className="btn primary" onClick={retry}>Try again</button></div> }
const PotMark = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="55 176 692 444" width={size * 1.56} height={size} aria-hidden>
    <path fill="#141414" d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z" />
    <path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z" />
  </svg>
)
const Logo = () => <span className="logo" aria-label="Teampot"><PotMark size={20} /><b>teampot</b></span>
function FillMark({ ratio, color = '#E8552D', small, tiny }: { ratio: number; color?: string; small?: boolean; tiny?: boolean }) {
  const lit = Math.round(Math.max(0, Math.min(1, ratio)) * 16)
  return (
    <svg className={`fill-mark ${small ? 'small' : ''} ${tiny ? 'tiny' : ''}`} viewBox="0 0 72 72" aria-hidden>
      {Array.from({ length: 16 }).map((_, i) => {
        const row = Math.floor(i / 4)
        const col = i % 4
        const fillIndex = 15 - i
        const on = fillIndex < lit
        return <rect key={i} x={8 + col * 14} y={8 + row * 14} width="10" height="10" rx="3" fill={on ? color : '#E4DED5'} opacity={on ? 1 : 0.8} />
      })}
    </svg>
  )
}
const FaceIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1.2 4.5 1.2 6 0" /></svg>
