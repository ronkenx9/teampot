import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ago, money, resetDate, type Held, type Person, type State } from './api'
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

  const refresh = useCallback(() => api.state().then(setS).catch(() => {}), [])
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t) }, [refresh])
  useEffect(() => { try { localStorage.setItem('tp-viewer', viewer) } catch { /* private mode */ } }, [viewer])

  const toast = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 6000)
  }
  const run = async <T,>(key: string, fn: () => Promise<T>, done: (r: T) => void) => {
    setBusy(key)
    try { done(await fn()) } catch (e: any) { toast({ text: e.message, tone: 'bad' }) } finally { setBusy(null); refresh() }
  }

  if (!s) return <div className="boot">Loading Teampot…</div>
  if (!s.seeded) return (
    <div className="boot">
      <Logo />
      <p>Set up Northwind Studio's team pots.</p>
      <button className="btn primary" disabled={!!busy} onClick={() => run('setup', api.setup, () => toast({ text: 'Team pots are ready', tone: 'good' }))}>
        {busy ? 'Setting up…' : 'Set up team pots'}
      </button>
    </div>
  )

  const ctx = { s, busy, run, toast }
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Logo /><span className="co">{s.company.name}</span></div>
        <div className="viewas" role="tablist" aria-label="View as">
          <span className="viewas-label">View as</span>
          {VIEWERS.map((v) => (
            <button key={v.id} role="tab" aria-selected={viewer === v.id} className={viewer === v.id ? 'on' : ''} onClick={() => setViewer(v.id)}>
              <Avatar name={v.full} small /> <span><b>{v.label}</b><small>{v.sub}</small></span>
            </button>
          ))}
        </div>
      </header>

      <main>
        {viewer === 'jordan' && <Finance {...ctx} />}
        {viewer === 'ava' && <Lead {...ctx} me={s.people.find((p) => p.id === 'ava')!} />}
        {viewer === 'sam' && <Employee {...ctx} me={s.people.find((p) => p.id === 'sam')!} />}
        {viewer === 'mateo' && <Contractor {...ctx} me={s.people.find((p) => p.id === 'mateo')!} />}
      </main>

      <footer className="foot">Demo company · test money · every receipt links to its public record</footer>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.text}</span>
            {t.receipt && <a href={t.receipt} target="_blank" rel="noreferrer">Receipt ↗</a>}
          </div>
        ))}
      </div>
    </div>
  )
}

type Ctx = {
  s: State; busy: string | null
  run: <T>(key: string, fn: () => Promise<T>, done: (r: T) => void) => Promise<void>
  toast: (t: Omit<Toast, 'id'>) => void
}

/* ---------------- Finance (Jordan) ---------------- */
function Finance({ s, busy, run, toast }: Ctx) {
  const staff = s.people.filter((p) => p.salary)
  const payroll = staff.reduce((a, p) => a + (p.salary || 0), 0)
  const waiting = s.held.filter((h) => h.status === 'held')
  const openInv = s.invoices.filter((i) => i.status === 'submitted')
  const lastPayday = s.activity.find((a) => a.kind === 'payday')

  return (
    <div className="grid">
      <section className="kpis span12">
        <Kpi label="Company balance" value={money(s.company.balance)} />
        <Kpi label="Monthly payroll" value={money(payroll)} sub={`${staff.length} people`} />
        <Kpi label="Waiting for approval" value={String(waiting.length)} tone={waiting.length ? 'warn' : undefined} />
        <Kpi label="Contractor invoices" value={String(openInv.length)} sub="to pay" />
      </section>

      <section className="card span7 payday">
        <div className="card-h"><h2>Payday</h2>{lastPayday && <span className="muted">Last run {ago(lastPayday.at)}</span>}</div>
        <ul className="rows">
          {staff.map((p) => (
            <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title}</small></span><span className="num">{money(p.salary!)}</span></li>
          ))}
        </ul>
        <div className="card-f">
          <span className="muted">Everyone is paid at once, in seconds.</span>
          <button className="btn primary" disabled={!!busy} onClick={() => run('payday', api.payday, (r: any) =>
            toast({ text: `Payday done · ${r.count} people · ${money(r.total)} · landed in ${(r.ms / 1000).toFixed(1)}s`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }))}>
            {busy === 'payday' ? 'Paying…' : `Run payday · ${money(payroll)}`}
          </button>
        </div>
      </section>

      <section className="card span5">
        <div className="card-h"><h2>Waiting for approval</h2><span className="pill">{waiting.length}</span></div>
        <Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} />
      </section>

      <section className="card span12">
        <div className="card-h"><h2>Team pots</h2><span className="muted">Limits and approved vendors are locked in for every person</span></div>
        <div className="pots">{s.pots.map((pt) => <PotCard key={pt.id} s={s} potId={pt.id} />)}</div>
      </section>

      <section className="card span6">
        <div className="card-h"><h2>Contractor invoices</h2></div>
        <Invoices s={s} busy={busy} run={run} toast={toast} canPay />
      </section>

      <section className="card span6">
        <div className="card-h"><h2>Activity</h2></div>
        <Feed s={s} />
      </section>
    </div>
  )
}

/* ---------------- Team lead (Ava) ---------------- */
function Lead({ s, busy, run, toast, me }: Ctx & { me: Person }) {
  const waiting = s.held.filter((h) => h.status === 'held' && h.potId === me.team)
  return (
    <div className="grid">
      <section className="card span7">
        <div className="card-h"><h2>Your team's pot</h2></div>
        <PotCard s={s} potId={me.team!} big />
      </section>
      <section className="card span5">
        <div className="card-h"><h2>Needs your OK</h2><span className="pill">{waiting.length}</span></div>
        <Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} />
      </section>
      <section className="span5"><Wallet s={s} me={me} busy={busy} run={run} toast={toast} /></section>
      <section className="card span7">
        <div className="card-h"><h2>Team activity</h2></div>
        <Feed s={s} filter={(a) => a.potId === me.team} />
      </section>
    </div>
  )
}

/* ---------------- Employee (Sam) ---------------- */
function Employee({ s, busy, run, toast, me }: Ctx & { me: Person }) {
  const pay = s.activity.find((a) => a.kind === 'payday')
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="hello"><Avatar name={me.name} /><div><small>Good to see you</small><b>{me.name.split(' ')[0]}</b></div></div>
        {pay && (
          <div className="payslip">
            <small>Payday landed · {ago(pay.at)}</small>
            <b>{money(me.salary || 0)}</b>
            <span>in your account · {money(me.balance)} total</span>
          </div>
        )}
        <Wallet s={s} me={me} busy={busy} run={run} toast={toast} />
        <div className="card flat">
          <div className="card-h"><h3>Recent</h3></div>
          <Feed s={s} filter={(a) => a.who === me.id || a.kind === 'payday'} compact />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Contractor (Mateo) ---------------- */
function Contractor({ s, busy, run, toast, me }: Ctx & { me: Person }) {
  const [amount, setAmount] = useState('1800')
  const [desc, setDesc] = useState('Q4 campaign illustrations')
  const mine = s.invoices.filter((i) => i.contractorId === me.id)
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="hello"><Avatar name={me.name} /><div><small>{me.title} · {me.country}</small><b>{me.name.split(' ')[0]}</b></div></div>
        <div className="payslip"><small>Paid to you</small><b>{money(me.balance)}</b><span>Get paid the moment {s.company.name} approves</span></div>
        <form className="card flat form" onSubmit={(e) => { e.preventDefault(); run('inv', () => api.invoice({ contractorId: me.id, amount: Number(amount), description: desc }), () => toast({ text: 'Invoice sent', tone: 'good' })) }}>
          <h3>Send an invoice</h3>
          <label>What for<input value={desc} onChange={(e) => setDesc(e.target.value)} required /></label>
          <label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label>
          <button className="btn primary" disabled={!!busy || !Number(amount)}>{busy === 'inv' ? 'Sending…' : `Send invoice · ${money(Number(amount) || 0)}`}</button>
        </form>
        <div className="card flat">
          <div className="card-h"><h3>Your invoices</h3></div>
          <Invoices s={s} busy={busy} run={run} toast={toast} items={mine} />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Shared pieces ---------------- */
function Wallet({ s, me, busy, run, toast }: Omit<Ctx, never> & { me: Person }) {
  const pot = s.pots.find((p) => p.id === me.team)!
  const [vendorId, setVendorId] = useState(() => s.vendors.find((v) => pot.vendorIds.includes(v.id))!.id)
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
    else toast({ text: r.held.reason === 'new-vendor' ? `Held for a sec · ${vendor.name} isn't on your team's list yet. Your lead's on it.` : `Held for a sec · that's over your monthly limit. Your lead's on it.`, tone: 'warn' })
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
        <div className="enroll">
          <FaceIcon />
          <span className="grow"><b>Pay with Face ID</b><small>Your device becomes your team card. Nothing to remember.</small></span>
          <button type="button" className="btn small primary" disabled={!!busy} onClick={() => run('enroll', () => enrollPasskey(me.id, me.name), () => toast({ text: 'Face ID is on. Payments now confirm on this device.', tone: 'good' }))}>
            {busy === 'enroll' ? 'Turning on…' : 'Turn on'}
          </button>
        </div>
      )}
      <form className="form" onSubmit={(e) => { e.preventDefault(); setConfirm(true) }}>
        <label>Pay
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <optgroup label="Approved for your team">{s.vendors.filter((v) => pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup>
            <optgroup label="Others (needs your lead's OK)">{s.vendors.filter((v) => !pot.vendorIds.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</optgroup>
          </select>
        </label>
        <div className="two">
          <label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label>
          <label>For<input placeholder={vendor.category} value={note} onChange={(e) => setNote(e.target.value)} maxLength={24} /></label>
        </div>
        {!onList && <p className="hint">{vendor.name} isn't on the {pot.team} list. It'll wait for your lead's OK.</p>}
        <button className="btn primary" disabled={!!busy || !Number(amount)}>Pay {money(Number(amount) || 0)}</button>
      </form>

      {confirm && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Confirm payment">
          <div className="sheet-card">
            <small>Paying from the {pot.team} pot</small>
            <b className="sheet-amt">{money(Number(amount))}</b>
            <span>to {vendor.name}{note ? ` · ${note}` : ''}</span>
            <button className="faceid" disabled={busy === 'spend'} onClick={pay}>
              <FaceIcon /> {busy === 'spend' ? (viaDevice ? 'Check your device…' : 'Paying…') : viaDevice ? 'Confirm with Face ID' : 'Confirm payment'}
            </button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Approvals({ s, items, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { items: Held[] }) {
  if (!items.length) return <Empty text="Nothing waiting. Nice." />
  return (
    <ul className="rows">
      {items.map((h) => {
        const p = s.people.find((x) => x.id === h.personId)!
        const v = s.vendors.find((x) => x.id === h.vendorId)!
        return (
          <li key={h.id} className="held">
            <Avatar name={p.name} />
            <span className="grow">
              <b>{p.name.split(' ')[0]} → {v.name} · {money(h.amount)}</b>
              <small>{h.reason === 'new-vendor' ? `New vendor for ${s.pots.find((x) => x.id === h.potId)?.team}` : 'Over monthly limit'} · {h.note} · {ago(h.at)}</small>
            </span>
            <button className="btn small ghost" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'return'), () => toast({ text: 'Returned. Nothing was paid.', tone: 'good' }))}>Return</button>
            <button className="btn small primary" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'approve'), (r: any) => toast({ text: `Approved · ${v.name} paid ${money(h.amount)}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>
              {busy === 'd' + h.id ? '…' : 'Approve'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Invoices({ s, busy, run, toast, items, canPay }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { items?: State['invoices']; canPay?: boolean }) {
  const list = items ?? s.invoices
  if (!list.length) return <Empty text="No invoices yet." />
  return (
    <ul className="rows">
      {list.map((i) => {
        const c = s.people.find((x) => x.id === i.contractorId)!
        return (
          <li key={i.id}>
            <Avatar name={c.name} />
            <span className="grow"><b>{i.number} · {c.name}</b><small>{i.description} · {c.country}</small></span>
            <span className="num">{money(i.amount)}</span>
            {i.status === 'paid'
              ? <span className="pill good">Paid{i.paidMs ? ` in ${(i.paidMs / 1000).toFixed(1)}s` : ''}</span>
              : canPay
                ? <button className="btn small primary" disabled={!!busy} onClick={() => run('inv' + i.id, () => api.payInvoice(i.id), (r: any) => toast({ text: `${c.name.split(' ')[0]} paid ${money(i.amount)} · landed in ${((r.paidMs || 0) / 1000).toFixed(1)}s`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }))}>{busy === 'inv' + i.id ? 'Paying…' : 'Approve & pay'}</button>
                : <span className="pill">Waiting</span>}
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
      <ul className="members">
        {members.map((m) => (
          <li key={m.id}><Avatar name={m.name} small /><span className="grow">{m.name.split(' ')[0]}</span><span className="muted">{money(Math.round(m.pot?.left ?? 0))} / {money(pot.perPersonCap)}</span></li>
        ))}
      </ul>
      {pot.approved > 0 && <small className="muted">Includes {money(pot.approved)} approved by the lead</small>}
      <div className="vendors">{pot.vendors.map((v) => <span key={v} className="chip">{v}</span>)}</div>
    </div>
  )
}

function Feed({ s, filter, compact }: { s: State; filter?: (a: State['activity'][number]) => boolean; compact?: boolean }) {
  const items = useMemo(() => (filter ? s.activity.filter(filter) : s.activity).slice(0, compact ? 6 : 12), [s.activity, filter, compact])
  if (!items.length) return <Empty text="Nothing yet." />
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id} className={`k-${a.kind}`}>
          <span className="dot" />
          <span className="grow"><b>{a.title}</b><small>{a.detail} · {ago(a.at)}</small></span>
          {a.amount !== undefined && <span className="num">{money(a.amount)}</span>}
          {a.receipt && <a className="rcpt" href={a.receipt} target="_blank" rel="noreferrer">Receipt ↗</a>}
        </li>
      ))}
    </ul>
  )
}

const Bar = ({ used, cap, color }: { used: number; cap: number; color: string }) => (
  <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.round(used)}>
    <i style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%`, background: color }} />
  </div>
)
const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) => (
  <div className={`kpi ${tone || ''}`}><small>{label}</small><b>{value}</b>{sub && <span className="muted">{sub}</span>}</div>
)
const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>
const Avatar = ({ name, small }: { name: string; small?: boolean }) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className={`av ${small ? 'sm' : ''}`} style={{ background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 50% 30%)` }} aria-hidden>{name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
}
const Logo = () => (
  <span className="logo" aria-label="Teampot">
    <svg viewBox="0 0 256 256" width="26" height="26" aria-hidden><rect x="24" y="100" width="208" height="32" rx="16" fill="#141414" /><path fill="#E8552D" d="M56 140 H200 A72 72 0 0 1 56 140 Z" /><circle cx="128" cy="62" r="22" fill="#141414" /></svg>
    <b>teamp<span>o</span>t</b>
  </span>
)
const FaceIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1.2 4.5 1.2 6 0" />
  </svg>
)
