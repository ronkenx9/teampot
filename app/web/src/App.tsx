import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ago, money, resetDate, type Activity, type Card, type Held, type Invoice, type Person, type State, type StockId } from './api'
import { createInvitePasskey, enrollPasskey, passkeysSupported, payWithPasskey, signInPasskey } from './passkey'
import { Glow, NextCard, Seg, SegBar, Tile, dotMoney, IconCard, IconCash, IconChart, IconClock, IconKey, IconPeople, Check } from './glide'

type Viewer = 'jordan' | 'ava' | 'sam' | 'mateo'
const VIEWERS: { id: Viewer; label: string; full: string; sub: string; avatar: string; do: string }[] = [
  { id: 'sam', label: 'Sam', full: 'Sam Okafor', sub: 'Designer', avatar: 'SO', do: "Spend from your team's budget and invest your pay." },
  { id: 'ava', label: 'Ava', full: 'Ava Chen', sub: 'Design lead', avatar: 'AC', do: "Approve your team's requests and set its rules." },
  { id: 'jordan', label: 'Jordan', full: 'Jordan Lee', sub: 'Finance', avatar: 'JL', do: 'Fund departments and run payday.' },
  { id: 'mateo', label: 'Mateo', full: 'Mateo Ruiz', sub: 'Contractor', avatar: 'MR', do: 'Send an invoice and get paid in seconds.' },
]
type Toast = { id: number; text: string; tone: 'good' | 'warn' | 'bad'; receipt?: string }
type Task = 'pay' | 'invest' | 'rules' | 'payday' | 'invoice' | 'invite' | 'topup' | 'howto'
type RoleMode = 'demo' | 'signin'

export default function App() {
  const [s, setS] = useState<State | null>(null)
  const [checked, setChecked] = useState(false)
  const [viewer, setViewer] = useState<Viewer>(() => (localStorage.getItem('tp-viewer') as Viewer) || 'sam')
  const [activeTab, setActiveTab] = useState('home')
  const [roleSheet, setRoleSheet] = useState<RoleMode | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
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
  const refresh = useCallback(async () => {
    try {
      const me = await api.me()
      if (!me.signedIn) {
        setS(null)
        return
      }
      load(await api.state())
    } catch (e: any) { setError(e.message) } finally { setChecked(true) }
  }, [])
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
  // The /tour walkthrough drives this app from the parent page (same origin only).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'tp-tour') return
      const { viewer: v, tab, task: t } = e.data as { viewer: Viewer; tab: string; task: Task | null }
      const show = () => { setActiveTab(tab || 'home'); setTask(t || null); window.scrollTo({ top: 0 }) }
      if (v && v !== viewer) switchDemo(v).then(() => setTimeout(show, 50))
      else show()
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
  }, [viewer])
  useEffect(() => { setActiveTab('home'); setTask(null); setProfileOpen(false) }, [viewer])

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

  const switchDemo = (id: Viewer) => {
    setViewer(id)
    setRoleSheet(null)
    setProfileOpen(false)
    return run('demo', () => api.demo(id), () => undefined)
  }
  const realSignIn = (id: Viewer) => run('signin', async () => {
    const ch = await api.challenge(id)
    const signed = await signInPasskey(id, ch.challenge, ch.credentialId)
    return api.verify({ ...signed, challengeId: ch.id })
  }, () => { setViewer(id); setRoleSheet(null); toast({ text: 'Signed in with Face ID', tone: 'good' }) })

  if (inviteToken) return <InviteAccept token={inviteToken} toast={toast} />
  if (!s && error) return <Shell><ErrorState text={error} retry={refresh} /></Shell>
  if (!s && !checked) return <Shell><Skeleton /></Shell>
  if (!s) return <WelcomeScreen busy={busy} mode={roleSheet} setMode={setRoleSheet} chooseDemo={switchDemo} signIn={realSignIn} />
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
    <Shell app>
      <RoleFrame
        s={s}
        viewer={viewer}
        active={activeTab}
        setActive={setActiveTab}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        switchDemo={switchDemo}
        realSignIn={realSignIn}
        busy={busy}
        onHelp={() => setTask('howto')}
      >
        {viewer === 'jordan' && <Finance {...ctx} active={activeTab} setTask={setTask} setActive={setActiveTab} />}
        {viewer === 'ava' && (s.people.find((p) => p.id === 'ava') ? <Lead {...ctx} active={activeTab} setTask={setTask} me={s.people.find((p) => p.id === 'ava')!} /> : <Skeleton />)}
        {viewer === 'sam' && (s.people.find((p) => p.id === 'sam') ? <Employee {...ctx} active={activeTab} setTask={setTask} me={s.people.find((p) => p.id === 'sam')!} /> : <Skeleton />)}
        {viewer === 'mateo' && (s.people.find((p) => p.id === 'mateo') ? <Contractor {...ctx} active={activeTab} setTask={setTask} me={s.people.find((p) => p.id === 'mateo')!} /> : <Skeleton />)}
      </RoleFrame>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'warn' && <FillMark ratio={0.35} small />}<span>{t.text}</span>{t.receipt && <a href={t.receipt} target="_blank" rel="noreferrer">Receipt</a>}</div>)}
      </div>
      {receipt && <ReceiptSheet data={receipt} close={() => setReceipt(null)} />}
      {task && <TaskSheet task={task} ctx={ctx} viewer={viewer} close={() => setTask(null)} />}
    </Shell>
  )
}

type Ctx = {
  s: State; busy: string | null
  run: <T>(key: string, fn: () => Promise<T>, done?: (r: T) => void) => Promise<void>
  toast: (t: Omit<Toast, 'id'>) => void
  openReceipt: (id: string) => void
}

const ROLE_TABS: Record<Viewer, { id: string; label: string }[]> = {
  sam: [{ id: 'home', label: 'Home' }, { id: 'spend', label: 'Spend' }, { id: 'invest', label: 'Invest' }, { id: 'activity', label: 'Activity' }],
  ava: [{ id: 'home', label: 'Home' }, { id: 'approvals', label: 'Approvals' }, { id: 'team', label: 'Team' }, { id: 'activity', label: 'Activity' }],
  jordan: [{ id: 'home', label: 'Home' }, { id: 'teams', label: 'Departments' }, { id: 'payday', label: 'Payday' }, { id: 'activity', label: 'Activity' }],
  mateo: [{ id: 'home', label: 'Home' }, { id: 'invoices', label: 'Invoices' }, { id: 'activity', label: 'Activity' }],
}

function WelcomeScreen({ busy, mode, setMode, chooseDemo, signIn }: {
  busy: string | null
  mode: RoleMode | null
  setMode: (m: RoleMode | null) => void
  chooseDemo: (id: Viewer) => void
  signIn: (id: Viewer) => void
}) {
  return (
    <div className="welcome">
      <main className="welcome-stage">
        <img className="welcome-mark" src="/mark3d.webp" width="1200" height="1200" alt="" />
        <h1>Teampot</h1>
        <p>Every team runs its own money.</p>
        {busy === 'demo' || busy === 'signin'
          ? <p className="welcome-loading" role="status"><span className="spinner" aria-hidden />Opening your view…</p>
          : <><button className="btn welcome-primary" onClick={() => setMode('demo')}>Try the demo</button>
            <button className="link-button" onClick={() => setMode('signin')}>Sign in with Face ID</button></>}
      </main>
      <span className="welcome-flat-mark"><PotMark size={34} /></span>
      {mode && (
        <RolePickerSheet
          title={mode === 'demo' ? 'Who do you want to be?' : 'Sign in as'}
          busy={busy}
          onCancel={() => setMode(null)}
          onPick={mode === 'demo' ? chooseDemo : signIn}
        />
      )}
    </div>
  )
}

function RolePickerSheet({ title, busy, onCancel, onPick }: { title: string; busy: string | null; onCancel: () => void; onPick: (id: Viewer) => void }) {
  return (
    <div className="sheet role-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-card role-picker">
        <div className="sheet-head"><button className="plain" onClick={onCancel}>Cancel</button><h2>{title}</h2><span /></div>
        <div className="role-grid">
          {VIEWERS.map((v) => (
            <button key={v.id} className="role-card" disabled={!!busy} onClick={() => onPick(v.id)}>
              <span className="role-avatar">{v.avatar}</span>
              <span><b>{v.full}</b><small>{v.sub}</small><em>{v.do}</em></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RoleFrame({ s, viewer, active, setActive, profileOpen, setProfileOpen, switchDemo, realSignIn, busy, onHelp, children }: {
  s: State
  viewer: Viewer
  active: string
  setActive: (id: string) => void
  profileOpen: boolean
  setProfileOpen: (open: boolean) => void
  switchDemo: (id: Viewer) => void
  realSignIn: (id: Viewer) => void
  busy: string | null
  onHelp: () => void
  children: ReactNode
}) {
  const person = VIEWERS.find((v) => v.id === viewer)!
  const tabs = ROLE_TABS[viewer]
  const [leaving, setLeaving] = useState(false)
  // Glide-style change: the screen blurs out, then the next one blurs in, staggered.
  const go = (id: string) => {
    if (id === active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setActive(id); return }
    setLeaving(true)
    setTimeout(() => { setActive(id); setLeaving(false); window.scrollTo({ top: 0 }) }, 170)
  }
  return (
    <div className="role-layout">
      <aside className="side-nav">
        <span className="side-brand"><PotMark size={18} /><b>teampot</b></span>
        <nav aria-label={`${person.label} sections`}>{tabs.map((t) => <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => go(t.id)}>{tabIcon(t.id)}<span>{t.label}</span></button>)}</nav>
      </aside>
      <div className="role-page">
        <header className="gl-top">
          <div className="profile">
            <button className="gl-avatar profile-button" aria-expanded={profileOpen} aria-label={`${person.full}, switch role`} onClick={() => setProfileOpen(!profileOpen)}>{person.avatar}</button>
            {profileOpen && (
              <div className="profile-menu">
                <p>Switch demo role</p>
                {VIEWERS.map((v) => <button key={v.id} className={viewer === v.id ? 'on' : ''} onClick={() => switchDemo(v.id)}><span className="role-avatar small">{v.avatar}</span><span><b>{v.label}</b><small>{v.sub}</small></span></button>)}
                <button className="signin-row" disabled={!!busy || s.auth?.demo === false} onClick={() => realSignIn(viewer)}><FaceIcon /> Sign in with Face ID</button>
              </div>
            )}
          </div>
          <div className="gl-title"><small>{s.company.name}</small><b>{tabs.find((t) => t.id === active)?.id === 'home' ? person.sub : tabs.find((t) => t.id === active)?.label}</b></div>
          <button className="gl-icon" aria-label="How Teampot works" onClick={onHelp}><KeyIcon /></button>
        </header>
        <main key={active} className={`screen ${leaving ? 'leaving' : ''}`}>{children}</main>
      </div>
      <nav className="bottom-tabs" aria-label={`${person.label} sections`}>{tabs.map((t) => <button key={t.id} className={active === t.id ? 'on' : ''} aria-label={t.label} onClick={() => go(t.id)}>{tabIcon(t.id)}<span>{t.label}</span></button>)}</nav>
    </div>
  )
}

function TaskSheet({ task, ctx, viewer, close }: { task: Task; ctx: Ctx; viewer: Viewer; close: () => void }) {
  const { s, busy, run, toast } = ctx
  const me = s.people.find((p) => p.id === viewer)
  const title: Record<Task, string> = {
    pay: 'Pay with your card',
    invest: 'Invest',
    rules: 'Card rules',
    payday: 'Review payday',
    invoice: 'Send invoice',
    invite: 'Invite someone',
    topup: 'Ask Finance for more',
    howto: 'How Teampot works',
  }
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title[task]}>
      <div className="sheet-card task-card">
        {task !== 'pay' && <div className="sheet-head"><span /><h2>{title[task]}</h2><button className="plain" onClick={close}>Done</button></div>}
        {task === 'pay' && me && <PayFlow s={s} me={me} busy={busy} run={run} toast={toast} close={close} />}
        {task === 'invest' && me && <InvestCard s={s} me={me} inv={s.investments.find((x) => x.personId === me.id)} busy={busy} run={run} toast={toast} />}
        {task === 'rules' && me?.team && <CardRules s={s} potId={me.team} busy={busy} run={run} toast={toast} onDone={close} />}
        {task === 'payday' && <PaydayTask s={s} busy={busy} run={run} toast={toast} />}
        {task === 'invoice' && me && <InvoiceComposer s={s} busy={busy} run={run} toast={toast} me={me} />}
        {task === 'invite' && <InvitePerson s={s} busy={busy} run={run} toast={toast} />}
        {task === 'topup' && me?.team && <TopUpRequest s={s} potId={me.team} busy={busy} run={run} toast={toast} onDone={close} />}
        {task === 'howto' && <HowItWorks s={s} viewer={viewer} />}
      </div>
    </div>
  )
}

function tabIcon(id: string) {
  const paths: Record<string, ReactNode> = {
    home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
    spend: <path d="M4 7h16v10H4zM7 11h.01M17 11h.01M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
    invest: <path d="m4 17 5-5 3 3 7-8M15 7h4v4" />,
    activity: <path d="M5 12h4l2-7 4 14 2-7h2" />,
    approvals: <path d="m5 13 4 4L19 7" />,
    team: <path d="M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />,
    payday: <path d="M6 7h12v10H6zM8 5v4M16 5v4M6 11h12" />,
    teams: <path d="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v2H4zM14 16h6v2h-6z" />,
    invoices: <path d="M7 3h8l4 4v14H7zM15 3v5h4M10 13h6M10 17h6" />,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[id] ?? paths.home}</svg>
}

function Finance({ s, busy, run, toast, openReceipt, active, setTask, setActive }: Ctx & { active: string; setTask: (task: Task) => void; setActive: (id: string) => void }) {
  const waiting = s.held.filter((h) => h.status === 'held' && h.reason === 'finance-rule')
  const topups = s.topups.filter((t) => t.status === 'requested')
  const openInv = s.invoices.filter((i) => i.status === 'submitted')
  const lastPayday = s.paydayRuns[0]
  const depts = s.controls.departments
  if (active === 'payday') return <div className="surface two-col"><PaydayTask s={s} busy={busy} run={run} toast={toast} /><section className="panel"><SectionTitle title="Payday history" sub="One payment from the treasury pays everyone, each line with a note." /><ul className="rows">{s.paydayRuns.length ? s.paydayRuns.map((p) => <li key={p.id}><span className="grow"><b>{p.date}</b><small>{plural(p.count, 'person', 'people')} · landed in {(p.ms / 1000).toFixed(1)}s</small></span><span className="num">{money(p.total)}</span><a className="rec" href={`https://explore.testnet.tempo.xyz/tx/${p.tx}`} target="_blank" rel="noreferrer">Record</a></li>) : <li><Empty text="No payday yet." /></li>}</ul></section></div>
  if (active === 'teams') return (
    <div className="surface">
      <PageIntro title="Departments" text="Each department has its own account on Tempo. You decide how much goes in and who holds the head key. The head runs everything inside it." action={<button className="btn small ghost" onClick={() => setTask('howto')}>How it works</button>} />
      {depts.map((d) => <DepartmentCard key={d.id} s={s} d={d} mode="finance" busy={busy} run={run} toast={toast} />)}
      <section className="panel"><SectionTitle title="People" sub="Finance sets salaries and appoints heads." action={<button className="btn small primary" onClick={() => setTask('invite')}>Invite</button>} /><Directory s={s} busy={busy} run={run} toast={toast} /></section>
      <CompanyRules s={s} busy={busy} run={run} toast={toast} />
    </div>
  )
  if (active === 'activity') return <div className="surface"><section className="panel"><SectionTitle title="Activity" sub="Every payment, approval and key change, with its public record." action={<a className="btn small ghost" href={api.activityCsv()}>Export CSV</a>} /><Feed s={s} openReceipt={openReceipt} /></section></div>
  const needs = waiting.length + topups.length + openInv.length
  const payroll = s.people.filter((p) => p.salary).reduce((sum, p) => sum + (p.salary ?? 0), 0)
  const staff = s.people.filter((p) => p.salary).length
  return (
    <div className="surface">
      <Glow tone="deep" label="Company treasury" value={dotMoney(s.company.balance)} sub={lastPayday ? `Last payday ${ago(lastPayday.at)}` : 'No payday yet'} top={<span className="pill-live">On Tempo</span>} />
      <div className="tiles">
        <Tile tone="lav" icon={<IconPeople />} value={String(depts.length)} label="Departments" />
        <Tile tone="sage" icon={<IconKey />} value={String(depts.filter((d) => d.head).length)} label="Head keys" />
        <Tile tone="butter" icon={<IconClock />} value={String(needs)} label="Need you" />
      </div>
      <NextCard eyebrow={`Payday · ${s.nextPayday}`} title="Pay everyone" chips={[`${staff} people`, money(payroll), 'One payment']} action={{ label: 'Review payday', onClick: () => setTask('payday') }} tone="sky" art={<PaydayArt />} />
      <section className="panel">
        <SectionTitle title={needs ? 'Needs you' : 'Nothing needs you'} sub={needs ? 'Only what a head can’t decide.' : 'Heads handle their own requests.'} />
        {topups.length > 0 && <TopUps s={s} items={topups} busy={busy} run={run} toast={toast} />}
        {waiting.length > 0 && <Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId="jordan" />}
        {openInv.length > 0 && <Invoices s={s} busy={busy} run={run} toast={toast} items={openInv} canPay />}
      </section>
      <section className="panel">
        <SectionTitle title="Departments" sub="Balance, head key and cards." action={<button className="btn small ghost" onClick={() => setActive('teams')}>Manage</button>} />
        <ul className="rows dept-rows">{depts.map((d) => <li key={d.id}><span className="dept-dot" style={{ background: d.color }} /><span className="grow"><b>{d.team}</b><small>{d.head ? `${d.head.name.split(' ')[0]} holds the head key` : 'No head yet · Finance runs it'} · {plural(d.cards.length, 'card', 'cards')}</small></span><span className="num">{money(d.balance ?? 0)}</span></li>)}</ul>
      </section>
    </div>
  )
}

function Lead({ s, busy, run, toast, openReceipt, me, active, setTask }: Ctx & { me: Person; active: string; setTask: (task: Task) => void }) {
  // A head never approves their own request; those go to Finance.
  const waiting = s.held.filter((h) => h.status === 'held' && h.potId === me.team && h.personId !== me.id && h.reason !== 'finance-rule')
  const invoices = s.invoices.filter((i) => i.status === 'submitted')
  const dept = s.controls.departments.find((d) => d.id === me.team)
  const myTopups = s.topups.filter((t) => t.potId === me.team).slice(0, 3)
  if (active === 'approvals') return <div className="surface"><section className="panel"><SectionTitle title="Approvals" sub="Approving pays with your head key." /><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={me.id} /></section><section className="panel"><SectionTitle title="Contractor invoices" sub={`Paid from ${dept?.team ?? 'your department'} with your head key.`} /><Invoices s={s} busy={busy} run={run} toast={toast} items={s.invoices} canPay /></section></div>
  if (active === 'team') return (
    <div className="surface">
      <PageIntro title={dept?.team ?? 'Team'} text="Every card below was signed by your head key. Change the rules and Teampot re-issues them; Tempo enforces the new limits right away." action={<button className="btn small primary" onClick={() => setTask('rules')}>Edit rules</button>} />
      {dept && <DepartmentCard s={s} d={dept} mode="head" busy={busy} run={run} toast={toast} />}
      <section className="panel"><SectionTitle title="Budget" sub="Finance decides how much is in the department. Ask when you need more." action={<button className="btn small ghost" onClick={() => setTask('topup')}>Ask for more</button>} />{myTopups.length ? <ul className="rows">{myTopups.map((t) => <li key={t.id}><span className="grow"><b>{money(t.amount)} · {t.note}</b><small>{t.status === 'requested' ? 'Waiting for Finance' : t.status === 'funded' ? 'Funded by Finance' : 'Declined'} · {ago(t.at)}</small></span></li>)}</ul> : <Empty text="No requests yet." />}</section>
      <section className="panel"><SectionTitle title="People" sub="Add employees and contractors to your team. Finance sets salaries." action={<button className="btn small ghost" onClick={() => setTask('invite')}>Invite</button>} /><Directory s={s} busy={busy} run={run} toast={toast} /></section>
    </div>
  )
  if (active === 'activity') return <div className="surface"><section className="panel"><SectionTitle title="Team activity" sub="Spend, approvals and card changes in your department." action={<a className="btn small ghost" href={api.activityCsv()}>Export CSV</a>} /><Feed s={s} filter={(a) => a.potId === me.team} openReceipt={openReceipt} /></section></div>
  const first = waiting[0]
  const firstWho = first ? s.people.find((p) => p.id === first.personId) : undefined
  const firstVendor = first ? s.vendors.find((v) => v.id === first.vendorId) : undefined
  return (
    <div className="surface">
      <Glow tone="dusk" label={`${dept?.team ?? ''} account`} value={dotMoney(dept?.balance ?? 0)} sub={waiting.length ? `${plural(waiting.length, 'request', 'requests')} waiting for you` : 'Nothing waiting'} top={<span className="pill-lime">Head key</span>} />
      <div className="tiles">
        <Tile tone="peach" icon={<IconClock />} value={String(waiting.length)} label="Waiting" />
        <Tile tone="lav" icon={<IconCard />} value={String(dept?.cards.length ?? 0)} label="Cards signed" />
        <Tile tone="sage" icon={<IconCash />} value={money(dept?.perPersonCap ?? 0)} unit="/mo" label="Card limit" />
      </div>
      {first && firstWho && firstVendor
        ? <NextCard eyebrow={`Waiting · ${ago(first.at)}`} title={`${firstWho.name.split(' ')[0]} → ${firstVendor.name}`} chips={[money(first.amount), first.reason === 'new-vendor' ? 'Not on the card' : 'Over the limit']} action={{ label: `Review ${firstWho.name.split(' ')[0]}'s request`, onClick: () => document.getElementById('lead-approvals')?.scrollIntoView({ behavior: 'smooth' }) }} tone="peach" />
        : <NextCard eyebrow="Your team" title="Edit card rules" chips={[`${money(dept?.perPersonCap ?? 0)} a month`, `${dept?.vendors.length ?? 0} vendors`]} action={{ label: 'Edit card rules', onClick: () => setTask('rules') }} tone="lav" />}
      <section className="panel" id="lead-approvals"><SectionTitle title="Waiting for you" sub="Approving pays with your head key." /><Approvals s={s} items={waiting} busy={busy} run={run} toast={toast} approverId={me.id} /></section>
      {invoices.length > 0 && <section className="panel"><SectionTitle title="Invoices" sub="Contractors on your team." /><Invoices s={s} busy={busy} run={run} toast={toast} items={invoices} canPay /></section>}
      <AuthorityCard s={s} viewer="ava" setTask={setTask} />
      <section className="panel"><SectionTitle title="Recent" sub="Your department, newest first." /><Feed s={s} filter={(a) => a.potId === me.team} compact openReceipt={openReceipt} /></section>
    </div>
  )
}

function Employee({ s, busy, run, toast, openReceipt, me, active, setTask }: Ctx & { me: Person; active: string; setTask: (task: Task) => void }) {
  if (active === 'spend') return <div className="surface"><MyCards s={s} me={me} onHowto={() => setTask('howto')} /><button className="btn primary big-cta" onClick={() => setTask('pay')}>Pay with your card</button><PerkCards s={s} me={me} busy={busy} run={run} toast={toast} /></div>
  if (active === 'invest') return <div className="surface"><InvestGlow s={s} me={me} /><InvestCard s={s} me={me} inv={s.investments.find((x) => x.personId === me.id)} busy={busy} run={run} toast={toast} /><EarnCard s={s} me={me} entry={s.earnEntries.find((e) => e.personId === me.id)} busy={busy} run={run} toast={toast} /></div>
  if (active === 'activity') return <div className="surface"><section className="panel"><SectionTitle title="Activity" sub="Your pay, your card and your receipts." /><Feed s={s} filter={(a) => a.who === me.id || a.kind === 'payday'} openReceipt={openReceipt} /></section></div>
  return <div className="surface"><MoneyHome s={s} me={me} openReceipt={openReceipt} setTask={setTask} /></div>
}

function Contractor({ s, busy, run, toast, me, active, setTask }: Ctx & { me: Person; active: string; setTask: (task: Task) => void }) {
  const mine = s.invoices.filter((i) => i.contractorId === me.id)
  if (active === 'invoices' || active === 'activity') return <div className="surface"><section className="panel"><SectionTitle title="Invoices" sub="Submitted, paid and declined work." action={<button className="btn small primary" onClick={() => setTask('invoice')}>Send invoice</button>} /><Invoices s={s} busy={busy} run={run} toast={toast} items={mine} /></section></div>
  const paid = mine.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0)
  return (
    <div className="surface">
      <Glow tone="swim" label="Paid to you" value={dotMoney(paid)} sub={mine.length ? plural(mine.length, 'invoice', 'invoices') : 'No invoices yet'} />
      <NextCard eyebrow={`Paid by ${s.pots.find((p) => p.id === me.team)?.team ?? 'Finance'}`} title="Send an invoice" chips={['Paid in seconds', 'Public record']} action={{ label: 'Send an invoice', onClick: () => setTask('invoice') }} tone="sky" />
      <AuthorityCard s={s} viewer="mateo" setTask={setTask} />
      <section className="panel"><SectionTitle title="Invoices" sub="Your team's head or Finance pays them." /><Invoices s={s} busy={busy} run={run} toast={toast} items={mine} /></section>
    </div>
  )
}

function MoneyHome({ s, me, openReceipt, setTask }: Pick<Ctx, 's' | 'openReceipt'> & { me: Person; setTask: (task: Task) => void }) {
  const pay = s.paydayRuns[0]
  const inv = s.investments.find((x) => x.personId === me.id)
  const earned = s.earnEntries.find((x) => x.personId === me.id)
  const invested = inv?.positions.reduce((a, p) => a + p.value, 0) ?? 0
  const earning = earned?.balance ?? 0
  const total = me.balance + invested + earning
  const dept = s.controls.departments.find((d) => d.id === me.team)
  const card = dept?.cards.find((c) => c.personId === me.id && c.kind === 'member')
  const [view, setView] = useState<'all' | 'card'>('all')
  const left = card?.left ?? 0
  return (
    <div className="money-home surface-stack">
      <Glow tone="swim" label={view === 'all' ? 'Your money' : `${dept?.team ?? ''} card left`} value={dotMoney(view === 'all' ? total : left)}
        sub={view === 'all' ? (pay ? `Payday landed ${ago(pay.at)}` : `Next payday ${s.nextPayday}`) : `of ${money(card?.cap ?? 0)} this month`}
        top={<Seg label="Show" options={[{ id: 'all', label: 'Money' }, { id: 'card', label: 'Card' }]} value={view} onChange={setView} />} />
      <div className="tiles">
        <Tile tone="lav" icon={<IconCash />} value={money(me.balance)} label="Cash" />
        <Tile tone="sage" icon={<IconChart />} value={money(invested)} label="Invested" />
        <Tile tone="butter" icon={<IconCard />} value={money(left)} label="Card left" />
      </div>
      {card && dept && <NextCard eyebrow={`Signed by ${card.issuedBy.split(' ')[0]} · ${dept.vendors.length} vendors`} title={`Pay with your ${dept.team} card`} chips={[`${money(left)} left`, `Next payday ${s.nextPayday.slice(5)}`]} action={{ label: 'Pay', onClick: () => setTask('pay') }} tone="sky" art={<CardStackArt color={dept.color} />} />}
      <section className="panel"><SectionTitle title="Recent" sub="Newest first." /><Feed s={s} filter={(a) => a.who === me.id || a.kind === 'payday'} compact openReceipt={openReceipt} /></section>
    </div>
  )
}

function InvestGlow({ s, me }: { s: State; me: Person }) {
  const inv = s.investments.find((x) => x.personId === me.id)
  const invested = inv?.positions.reduce((a, p) => a + p.value, 0) ?? 0
  const gain = inv?.positions.reduce((a, p) => a + p.gain, 0) ?? 0
  return <Glow tone="ember" label="Invested" value={dotMoney(invested)} sub={invested ? `${gain >= 0 ? '+' : '−'}${money(Math.abs(gain), true)} since you bought` : 'Nothing invested yet'} top={<span className="pill-live">Delayed prices</span>} />
}

/** Small illustrations for the "up next" cards. */
function CardStackArt({ color }: { color: string }) {
  return <svg viewBox="0 0 220 96" width="220" height="96" className="art-cards">{[0, 1, 2].map((i) => <rect key={i} x={30 + i * 26} y={34 - i * 8} width="120" height="74" rx="12" fill={i === 2 ? '#0B0B0C' : '#fff'} opacity={i === 2 ? 1 : 0.7 + i * 0.1} />)}<rect x="96" y="30" width="18" height="4" rx="2" fill={color} /><text x="96" y="52" className="art-t">CARD</text></svg>
}
function PaydayArt() {
  return <svg viewBox="0 0 260 96" width="260" height="96" className="art-pay">{[0, 1, 2, 3].map((i) => <g key={i}><path d={`M20 70 C 90 70, 120 ${20 + i * 16}, 200 ${20 + i * 16}`} fill="none" stroke="#fff" strokeWidth="2" /><circle r="4" fill="#0B0B0C"><animateMotion dur="2.6s" begin={`${i * 0.35}s`} repeatCount="indefinite" path={`M20 70 C 90 70, 120 ${20 + i * 16}, 200 ${20 + i * 16}`} /></circle><rect x="200" y={12 + i * 16} width="40" height="14" rx="7" fill="#fff" /></g>)}<rect x="0" y="60" width="40" height="20" rx="10" fill="#0B0B0C" /></svg>
}

/** The person's cards exactly as Tempo holds them: who signed them, the limit, the vendors. */
function MyCards({ s, me, onHowto }: { s: State; me: Person; onHowto?: () => void }) {
  const dept = s.controls.departments.find((d) => d.id === me.team)
  const cards = dept?.cards.filter((c) => c.personId === me.id) ?? []
  if (!dept || !cards.length) return null
  return (
    <section className="panel">
      <SectionTitle title="Your cards" sub={`Signed by ${dept.head ? dept.head.name.split(' ')[0] : 'Finance'}. Tempo blocks anything over the limit or off the list.`} action={onHowto && <button className="btn small ghost" onClick={onHowto}>How it works</button>} />
      <ul className="wcards">{cards.map((c) => (
        <li key={c.id}>
          <WalletCard c={c} color={dept.color} />
          <p className="wcard-vendors"><span>{c.vendors.join(' · ')}</span>{c.receipt && <a className="rec" href={c.receipt} target="_blank" rel="noreferrer">Record</a>}</p>
        </li>
      ))}</ul>
    </section>
  )
}

/** A card exactly as Tempo holds it: its limit, what's left this period, and who signed it. */
function WalletCard({ c, color }: { c: Card; color: string }) {
  const pct = c.left !== null && c.cap ? Math.max(0, Math.min(100, (c.left / c.cap) * 100)) : 0
  return (
    <div className="wcard" style={{ ['--pot' as any]: color }}>
      <div className="wcard-top"><span className="wcard-stripe" /><span className="wcard-label">{c.label}</span><span className="wcard-issuer">Signed by {c.issuedBy.split(' ')[0]}</span></div>
      <div className="wcard-amt"><b>{c.left !== null ? money(Math.round(c.left)) : '—'}</b><small>left of {money(c.cap)} a {c.period}</small></div>
      <div className="wcard-bar" aria-hidden><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function PageIntro({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <section className="page-intro"><div><h1>{title}</h1><p>{text}</p></div>{action}</section>
}

/** One line telling each person what they control and who gave it to them. */
function AuthorityCard({ s, viewer, setTask }: { s: State; viewer: Viewer; setTask: (task: Task) => void }) {
  const depts = s.controls.departments
  const me = s.people.find((p) => p.id === viewer)
  const dept = depts.find((d) => d.id === me?.team)
  const limit = money(s.company.financeApprovalThreshold)
  const copy: Record<Viewer, { title: string; text: string; link?: string }> = {
    jordan: { title: 'You hold the treasury', text: `${plural(depts.length, 'department', 'departments')}, ${depts.filter((d) => d.head).length} with a head. A head can spend only what you put in their department, and you can take their key back at any time.`, link: s.controls.treasury.link },
    ava: { title: `You hold the ${dept?.team ?? ''} head key`, text: `Finance gave it to you on the ${dept?.team ?? ''} account. Use it to issue cards, approve requests and pay contractors. Anything over ${limit} goes to Finance.`, link: dept?.head?.receipt },
    sam: { title: `Your ${dept?.team ?? ''} card`, text: `${dept ? money(dept.perPersonCap) : ''} a month at ${dept?.vendors.length ?? 0} approved vendors, issued by ${dept?.head?.name.split(' ')[0] ?? 'Finance'}. Anything else waits for an OK.`, link: dept?.cards.find((c) => c.personId === viewer)?.receipt },
    mateo: { title: `Paid by ${dept?.team ?? 'Finance'}`, text: `Your invoices are paid from the ${dept?.team ?? 'company'} account by its head or by Finance, usually in seconds.` },
  }
  const c = copy[viewer]
  return (
    <section className="authority">
      <span className="authority-icon" aria-hidden><KeyIcon /></span>
      <div className="grow"><b>{c.title}</b><p>{c.text}</p></div>
      <div className="authority-links"><button className="plain" onClick={() => setTask('howto')}>How it works</button>{c.link && <a href={c.link} target="_blank" rel="noreferrer">Record</a>}</div>
    </section>
  )
}

function HowItWorks({ s, viewer }: { s: State; viewer: Viewer }) {
  const limit = money(s.company.financeApprovalThreshold)
  const levels: { id: Viewer | 'dept'; title: string; text: string }[] = [
    { id: 'jordan', title: 'Company treasury', text: 'Finance holds it. It funds departments and pays everyone on payday in one payment.' },
    { id: 'dept', title: 'Department account', text: 'Every department has its own account. Its balance is its budget. Finance can add money or pull it back.' },
    { id: 'ava', title: 'Head key', text: 'Finance gives the head a key on the department account. The head issues cards, approves requests and pays contractors, never more than the department holds.' },
    { id: 'sam', title: 'Cards', text: 'The head signs each card with a monthly limit and a list of approved vendors. People pay from their phone.' },
  ]
  return (
    <div className="howto">
      <p className="lede">Each level gets its own key on Tempo, and each key can only do what the level above allowed. Tempo rejects everything else, so the rules hold even if Teampot is down.</p>
      <ol className="ladder">{levels.map((l) => <li key={l.id} className={l.id === viewer ? 'you' : ''}><b>{l.title}{l.id === viewer && <em>You</em>}</b><span>{l.text}</span></li>)}</ol>
      <div className="enforced">
        <div><h3>Tempo enforces</h3><ul><li>Monthly limit on every card</li><li>Approved vendors only</li><li>Only a head key can issue cards</li><li>A revoked key stops working at once</li></ul></div>
        <div><h3>Teampot enforces</h3><ul><li>Payments over {limit} need Finance</li><li>No approving your own request</li><li>Who can see whose pay</li></ul></div>
      </div>
      <p className="muted small">Demo note: department roots and demo keys are held by the Teampot server. People who join by invite use Face ID on their own phone, so their card never leaves the device.</p>
      <a className="btn ghost" href={s.controls.treasury.link} target="_blank" rel="noreferrer">See the company account on Tempo</a>
    </div>
  )
}

function DepartmentCard({ s, d, mode, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { d: State['controls']['departments'][number]; mode: 'finance' | 'head' }) {
  const [amount, setAmount] = useState('500')
  const [panel, setPanel] = useState<'head' | 'money' | null>(null)
  const team = s.people.filter((p) => p.team === d.id && p.role !== 'contractor')
  const [nextHead, setNextHead] = useState(d.head?.personId ?? team[0]?.id ?? '')
  const toggle = (x: 'head' | 'money') => setPanel((p) => (p === x ? null : x))
  return (
    <section className="panel dept-card" style={{ ['--pot' as any]: d.color }}>
      <header className="dept-top">
        <div><p className="eyebrow">Department account</p><h2>{d.team}</h2><a href={d.link} target="_blank" rel="noreferrer">Public record</a></div>
        <div className="dept-bal"><b>{money(d.balance ?? 0)}</b>{mode === 'finance' && <button className="btn small ghost" onClick={() => toggle('money')}>{panel === 'money' ? 'Close' : 'Move money'}</button>}</div>
      </header>
      {mode === 'finance' && panel === 'money' && (
        <div className="dept-drawer">
          <p className="muted">Moves real money between the treasury and {d.team}.</p>
          <div className="inline-form">
            <div className="money-in"><span>$</span><input aria-label={`Amount for ${d.team}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div>
            <button className="btn small primary" disabled={!!busy || !Number(amount)} onClick={() => run('fund' + d.id, () => api.fundPot(d.id, Number(amount)), (r: any) => { setPanel(null); toast({ text: `${money(Number(amount))} sent to ${d.team}`, tone: 'good', receipt: r.receipt }) })}>Add money</button>
            <button className="btn small ghost" disabled={!!busy || !Number(amount)} onClick={() => run('return' + d.id, () => api.returnPot(d.id, Number(amount)), (r: any) => { setPanel(null); toast({ text: `${money(Number(amount))} back from ${d.team}`, tone: 'good', receipt: r.receipt }) })}>Pull back</button>
          </div>
        </div>
      )}
      <div className="dept-level">
        <p className="eyebrow">Head key</p>
        <div className="level-row">
          {d.head ? <Avatar name={d.head.name} /> : <span className="avatar-empty" aria-hidden />}
          <span className="grow"><b>{d.head ? d.head.name : 'No head yet'}</b><small>{d.head ? `Admin key from Finance${d.head.since ? ` · ${ago(d.head.since)}` : ''}` : 'Finance runs this department directly'}</small></span>
          {d.head?.receipt && <a className="rec" href={d.head.receipt} target="_blank" rel="noreferrer">Record</a>}
          {mode === 'finance' && team.length > 0 && <button className="btn small ghost" onClick={() => toggle('head')}>{panel === 'head' ? 'Close' : d.head ? 'Change' : 'Appoint'}</button>}
        </div>
        {mode === 'finance' && panel === 'head' && (
          <div className="inline-form dept-drawer">
            <select aria-label={`Head of ${d.team}`} value={nextHead} onChange={(e) => setNextHead(e.target.value)}>{team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button className="btn small primary" disabled={!!busy || !nextHead || nextHead === d.head?.personId} onClick={() => run('head' + d.id, () => api.appointHead(d.id, nextHead), (r: any) => { setPanel(null); toast({ text: `${s.people.find((p) => p.id === nextHead)?.name.split(' ')[0]} now holds the ${d.team} head key`, tone: 'good', receipt: r.receipt }) })}>{busy === 'head' + d.id ? 'Signing…' : d.head ? 'Hand over key' : 'Make head'}</button>
          </div>
        )}
      </div>
      <div className="dept-level">
        <p className="eyebrow">Cards · {money(d.perPersonCap)} a month at {d.vendors.length} vendors</p>
        {d.cards.length ? <ul className="rows card-rows">{d.cards.map((c) => (
          <li key={c.id}>
            <Avatar name={c.name} small />
            <span className="grow"><b>{c.name.split(' ')[0]} · {c.label}</b><small>Signed by {c.issuedBy}{c.device ? ' · Face ID' : ''}</small></span>
            <span className="card-left"><b>{c.left !== null ? money(Math.round(c.left)) : '—'}</b><small>of {money(c.cap)}/{c.period}</small></span>
            {c.receipt && <a className="rec icon" href={c.receipt} target="_blank" rel="noreferrer" aria-label={`Public record for ${c.name}'s ${c.label}`}>↗</a>}
          </li>
        ))}</ul> : <Empty text="No cards yet." />}
      </div>
    </section>
  )
}

function TopUps({ s, items, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { items: State['topups'] }) {
  return <ul className="rows">{items.map((t) => {
    const dept = s.pots.find((p) => p.id === t.potId)
    const who = s.people.find((p) => p.id === t.requestedBy)
    return <li key={t.id}><span className="grow"><b>{dept?.team} wants {money(t.amount)} more</b><small>{who?.name.split(' ')[0]} · {t.note} · {ago(t.at)}</small></span><button className="btn small ghost" disabled={!!busy} onClick={() => run('t' + t.id, () => api.decideTopup(t.id, 'decline'), () => toast({ text: 'Top-up declined', tone: 'good' }))}>Decline</button><button className="btn small primary" disabled={!!busy} onClick={() => run('t' + t.id, () => api.decideTopup(t.id, 'fund'), (r: any) => toast({ text: `${dept?.team} funded ${money(t.amount)}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>Fund</button></li>
  })}</ul>
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</div>
}

function MoneyParts({ value }: { value: number }) {
  const [whole, cents] = money(value, true).split('.')
  return <>{whole}<span>.{cents}</span></>
}

function Directory({ s, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'>) {
  return <ul className="rows">{s.people.filter((p) => p.role !== 'contractor').map((p) => <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title} · {p.team || 'Finance'}</small></span>{p.salary && <span className="num">{money(p.salary)}</span>}{p.role !== 'admin' && p.id !== s.auth?.personId && (s.auth?.role === 'admin' || p.role !== 'lead') && <button className="btn small ghost" disabled={!!busy} onClick={() => run('remove' + p.id, () => api.removePerson(p.id), () => toast({ text: `${p.name.split(' ')[0]} removed`, tone: 'good' }))}>Remove</button>}</li>)}</ul>
}

function PaydayTask({ s, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'>) {
  const staff = s.people.filter((p) => p.salary)
  const payroll = staff.reduce((a, p) => a + (p.salary || 0), 0)
  const [confirmPayday, setConfirmPayday] = useState(false)
  const [paydayParty, setPaydayParty] = useState<{ total: number; count: number; receipt?: string } | null>(null)
  const [nextDate, setNextDate] = useState(s.nextPayday)
  useEffect(() => setNextDate(s.nextPayday), [s.nextPayday])
  return (
    <section className="panel payday-panel">
      <SectionTitle title="Review payday" sub="Preview the batch, then confirm once." />
      <div className="date-row">
        <label>Next payday<input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>
        <button className="btn ghost" disabled={!!busy || nextDate === s.nextPayday} onClick={() => run('paydate', () => api.setPayday(nextDate), () => toast({ text: 'Next payday saved', tone: 'good' }))}>Save date</button>
      </div>
      <ul className="rows">{staff.map((p) => <li key={p.id}><Avatar name={p.name} /><span className="grow"><b>{p.name}</b><small>{p.title}</small></span><span className="num">{money(p.salary!)}</span></li>)}</ul>
      <div className="card-f"><span className="muted">{plural(staff.length, 'person', 'people')} · {money(payroll)} total</span><button className="btn primary" disabled={!!busy} onClick={() => setConfirmPayday(true)}>Run payday</button></div>
      {confirmPayday && <ConfirmSheet title="Run payday?" amount={money(payroll)} detail={`${plural(staff.length, 'person', 'people')} · ${s.nextPayday}`} busy={busy === 'payday'} actionText="Confirm with Face ID" onCancel={() => setConfirmPayday(false)} onConfirm={() => run('payday', api.payday, (r: any) => { setConfirmPayday(false); setPaydayParty({ total: r.total, count: r.count, receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }); toast({ text: `Payday complete · ${plural(r.count, 'person', 'people')}`, tone: 'good', receipt: `https://explore.testnet.tempo.xyz/tx/${r.tx}` }) })} face />}
      {paydayParty && <PaydaySuccessSheet total={paydayParty.total} count={paydayParty.count} receipt={paydayParty.receipt} close={() => setPaydayParty(null)} />}
    </section>
  )
}

function InvoiceComposer({ busy, run, toast, me }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person }) {
  const [amount, setAmount] = useState('1800')
  const [desc, setDesc] = useState('Q4 campaign illustrations')
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run('inv', () => api.invoice({ contractorId: me.id, amount: Number(amount), description: desc }), () => toast({ text: 'Invoice sent', tone: 'good' })) }}>
      <label>What for<input value={desc} onChange={(e) => setDesc(e.target.value)} required /></label>
      <label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div></label>
      <button className="btn primary" disabled={!!busy || !Number(amount)}>{busy === 'inv' ? 'Sending...' : `Send invoice · ${money(Number(amount) || 0)}`}</button>
    </form>
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
  const [mode, setMode] = useState<'buy' | 'sell' | 'payday'>('buy')
  const selected = s.stocks.find((x) => x.id === stockId) ?? s.stocks[0]
  const delayed = selected?.delayed ? 'Delayed prices' : 'Live prices'
  const positions = inv?.positions ?? []
  const worth = positions.reduce((a, p) => a + p.value, 0)
  return (
    <section className="card flat invest-card">
      <div className="invest-head"><div><small>Your shares</small><b>{money(worth, true)}</b></div><span className="pill">{delayed}</span></div>
      <div className="stock-list">
        {positions.length ? positions.map((p) => {
          const st = s.stocks.find((x) => x.id === p.stockId)!
          return <div key={p.stockId} className="stock-row"><span><b>{st.display}</b><small>{p.shares} shares · avg {money(p.avgCost, true)}</small></span><span className="num">{money(p.value, true)}<small className={p.gain >= 0 ? 'gain' : 'loss'}>{p.gain >= 0 ? '+' : ''}{money(p.gain, true)}</small></span></div>
        }) : <Empty text="No shares yet. Buy a slice below, or send part of each payday." />}
      </div>
      <div className="segmented" role="tablist" aria-label="Invest action">
        {([['buy', 'Buy'], ['sell', 'Sell'], ['payday', 'Each payday']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>)}
      </div>
      {mode === 'buy' && <form className="form compact-form trade-form" onSubmit={(e) => { e.preventDefault(); run('trade-buy', () => api.trade({ personId: me.id, stockId, side: 'buy', cashAmount: Number(cash) }), (r: any) => toast({ text: `Bought ${r.shares} shares`, tone: 'good', receipt: r.receipt })) }}>
        <div className="two"><label>Stock<select value={stockId} onChange={(e) => setStockId(e.target.value as StockId)}>{s.stocks.map((st) => <option key={st.id} value={st.id}>{st.display} · {money(st.lastPrice, true)}</option>)}</select></label><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))} /></div></label></div>
        <button className="btn primary" disabled={!!busy || !Number(cash)}>Buy {money(Number(cash) || 0)}</button>
      </form>}
      {mode === 'sell' && <form className="form compact-form trade-form" onSubmit={(e) => { e.preventDefault(); run('trade-sell', () => api.trade({ personId: me.id, stockId: sellStock, side: 'sell', shares: Number(sellShares) }), (r: any) => toast({ text: `Sold ${r.shares} shares`, tone: 'good', receipt: r.receipt })) }}>
        <div className="two"><label>Stock<select value={sellStock} onChange={(e) => setSellStock(e.target.value as StockId)}>{(positions.length ? positions : s.stocks.map((st) => ({ stockId: st.id }))).map((p: any) => { const st = s.stocks.find((x) => x.id === p.stockId)!; return <option key={st.id} value={st.id}>{st.display}</option> })}</select></label><label>Shares<input inputMode="decimal" value={sellShares} onChange={(e) => setSellShares(e.target.value.replace(/[^\d.]/g, ''))} /></label></div>
        <button className="btn primary" disabled={!!busy || !Number(sellShares)}>Sell</button>
      </form>}
      {mode === 'payday' && <form className="form compact-form" onSubmit={(e) => { e.preventDefault(); run('election', () => api.election({ personId: me.id, stockId, percent: Number(percent) }), () => toast({ text: 'Payday investing saved', tone: 'good' })) }}>
        <p className="hint">A share of every payday buys this stock automatically.</p>
        <div className="two"><label>Share of payday<div className="money-in"><input inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ''))} /><span style={{ paddingRight: 12 }}>%</span></div></label><label>Stock<select value={stockId} onChange={(e) => setStockId(e.target.value as StockId)}>{s.stocks.map((st) => <option key={st.id} value={st.id}>{st.display}</option>)}</select></label></div>
        <button className="btn primary" disabled={!!busy}>Save</button>
      </form>}
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

/** Pay with the department card. Tempo checks the limit and vendor list; anything else becomes a request to the head. */
function PayFlow({ s, me, busy, run, toast, close }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { me: Person; close: () => void }) {
  const pot = s.pots.find((p) => p.id === me.team)!
  const dept = s.controls.departments.find((d) => d.id === pot.id)
  const card = dept?.cards.find((c) => c.personId === me.id && c.kind === 'member')
  const onCard = s.vendors.filter((v) => pot.vendorIds.includes(v.id))
  const offCard = s.vendors.filter((v) => !pot.vendorIds.includes(v.id))
  const [vendorId, setVendorId] = useState(onCard[0]?.id ?? s.vendors[0].id)
  const [amount, setAmount] = useState('45')
  const [result, setResult] = useState<null | { ok: boolean; receipt?: string; ms: number; reason?: string }>(null)
  const vendor = s.vendors.find((v) => v.id === vendorId)!
  const onList = pot.vendorIds.includes(vendorId)
  const head = dept?.head?.name.split(' ')[0] ?? 'Finance'
  const viaDevice = !!me.hasPasskey && passkeysSupported()
  const left = card?.left ?? me.pot?.left ?? 0
  const cap = card?.cap ?? me.pot?.cap ?? 0
  const n = Number(amount) || 0
  const spend = async () => {
    if (!viaDevice) return api.spend({ personId: me.id, vendorId, amount: n, note: vendor.category })
    const out = await payWithPasskey(me.id, vendorId, n, `${pot.id}:${vendor.category}`)
    return api.recordPasskey({ personId: me.id, vendorId, amount: n, note: vendor.category, ...('tx' in out ? { tx: out.tx } : { rejected: true }) })
  }
  const pay = () => {
    const t0 = performance.now()
    run('spend', spend, (r: any) => {
      const ms = performance.now() - t0
      setResult(r.ok ? { ok: true, receipt: r.receipt, ms } : { ok: false, ms, reason: r.held?.reason })
      if (r.ok) toast({ text: `Paid ${vendor.name} ${money(n)}`, tone: 'good', receipt: r.receipt })
      else toast({ text: r.held?.reason === 'new-vendor' ? `Held for a sec · ${vendor.name} needs ${head}'s OK.` : `Held for a sec · that's over your monthly limit.`, tone: 'warn' })
    })
  }
  if (result) return (
    <div className="flow">
      <div className="flow-head"><button className="circle-btn" aria-label="Close" onClick={close}>✕</button><span className={result.ok ? 'pill-lime' : 'pill-lime pill-amber'}>{result.ok ? `Paid in ${(result.ms / 1000).toFixed(1)}s` : `Waiting for ${head}`}</span></div>
      <div className={`stamp ${result.ok ? '' : 'held'}`}><span>{result.ok ? 'PAID' : 'HELD'}</span></div>
      <div className="receipt-card">
        <div className="rc-top"><b>{result.ok ? 'Payment complete' : `Sent to ${head}`}</b>{result.ok && <Check />}</div>
        <p className="flow-sub">{vendor.name} · {pot.team} card</p>
        <b className="big">{money(n, true)}</b>
        <SegBar used={result.ok ? cap - left + n : cap - left} cap={cap} />
        <div className="kv"><div><small>{result.ok ? 'Paid from' : 'Why'}</small><b>{result.ok ? `${pot.team} account` : result.reason === 'new-vendor' ? 'Not on your card' : 'Over your limit'}</b></div><div><small>{result.ok ? 'Checked by' : 'Next'}</small><b>{result.ok ? 'Tempo' : `${head} approves`}</b></div></div>
      </div>
      <div className="flow-actions">{result.ok && result.receipt ? <a className="btn pale" href={result.receipt} target="_blank" rel="noreferrer">View public record →</a> : <span className="flow-note">Tempo refused the card, so nothing was paid. {head} can approve it from the department.</span>}<button className="round-btn" aria-label="Done" onClick={close}><Check /></button></div>
    </div>
  )
  return (
    <div className="flow">
      <div className="flow-head"><button className="circle-btn" aria-label="Back" onClick={close}>←</button><span className="pill-live">{money(Math.round(left))} left</span></div>
      <h1 className="flow-title">Pay</h1>
      <p className="flow-sub">{pot.team} card · signed by {head}</p>
      <div className="amount-card">
        <div className="amount-top"><span>Amount</span><span>{money(Math.round(left))} of {money(cap)}</span></div>
        <label className="amount-input"><span>$</span><input inputMode="decimal" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        <SegBar used={cap - left} cap={cap} />
      </div>
      {passkeysSupported() && !me.hasPasskey && (
        <div className="enroll"><FaceIcon /><span className="grow"><b>Use Face ID on this phone</b><small>Your card moves onto this device.</small></span><button type="button" className="btn small primary" disabled={!!busy} onClick={() => run('enroll', () => enrollPasskey(me.id, me.name), () => toast({ text: 'Face ID is on. Payments now confirm on this device.', tone: 'good' }))}>{busy === 'enroll' ? 'Turning on...' : 'Turn on'}</button></div>
      )}
      <p className="eyebrow">On your card</p>
      <div className="vendor-chips" role="radiogroup" aria-label="Vendors on your card">{onCard.map((v) => <button key={v.id} role="radio" aria-checked={vendorId === v.id} className={`vchip ${vendorId === v.id ? 'on' : ''}`} onClick={() => setVendorId(v.id)}>{v.name}</button>)}</div>
      <p className="eyebrow">Not on your card · needs {head}</p>
      <div className="vendor-chips" role="radiogroup" aria-label="Vendors that need approval">{offCard.map((v) => <button key={v.id} role="radio" aria-checked={vendorId === v.id} className={`vchip off ${vendorId === v.id ? 'on' : ''}`} onClick={() => setVendorId(v.id)}>{v.name}</button>)}</div>
      <p className={`flow-note ${onList ? '' : 'warn'}`}>{onList ? 'Tempo checks your limit and the vendor list when you pay.' : `${vendor.name} isn't on your card, so Tempo will refuse it and ${head} gets a request instead.`}</p>
      <div className="flow-actions"><button className="btn pale" onClick={close}>Cancel</button><button className="round-btn" disabled={!!busy || !n} aria-label={`Pay ${money(n)} to ${vendor.name}`} onClick={pay}>{busy === 'spend' ? '…' : <FaceIcon />}</button></div>
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
  if (!items.length) return <Empty text="Nothing waiting." />
  return <ul className="requests">{items.map((h) => {
    const p = s.people.find((x) => x.id === h.personId)!
    const v = s.vendors.find((x) => x.id === h.vendorId)!
    const team = s.pots.find((x) => x.id === h.potId)?.team
    const why = h.reason === 'new-vendor' ? `Not on the ${team} card` : h.reason === 'finance-rule' ? `Over the ${money(s.company.financeApprovalThreshold)} Finance limit` : 'Over their monthly limit'
    return (
      <li key={h.id} className="request">
        <div className="request-top"><Avatar name={p.name} /><span className="grow"><b>{p.name.split(' ')[0]} → {v.name}</b><small>{why} · {h.note} · {ago(h.at)}</small></span><span className="request-amt">{money(h.amount)}</span></div>
        <div className="request-actions">
          <button className="btn small ghost" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'return', approverId), () => toast({ text: 'Returned. Nothing was paid.', tone: 'good' }))}>Return</button>
          {h.reason === 'new-vendor' && <button className="btn small ghost" disabled={!!busy} onClick={() => run('a' + h.id, () => api.decide(h.id, 'approve-add', approverId), (r: any) => toast({ text: `Approved and added · ${v.name}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>Approve + add</button>}
          <button className="btn small primary" disabled={!!busy} onClick={() => run('d' + h.id, () => api.decide(h.id, 'approve', approverId), (r: any) => toast({ text: `Approved · ${v.name} paid ${money(h.amount)}`, tone: 'good', receipt: r.tx ? `https://explore.testnet.tempo.xyz/tx/${r.tx}` : undefined }))}>{busy === 'd' + h.id ? '…' : 'Approve'}</button>
        </div>
      </li>
    )
  })}</ul>
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

function CardRules({ s, potId, busy, run, toast, onDone }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { potId: string; onDone?: () => void }) {
  const pot = s.pots.find((p) => p.id === potId)!
  const [cap, setCap] = useState(String(pot.perPersonCap))
  const [vendorIds, setVendorIds] = useState<string[]>(pot.vendorIds)
  const toggle = (id: string) => setVendorIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])
  const signer = s.controls.departments.find((d) => d.id === potId)?.head?.name.split(' ')[0]
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run('rules', () => api.updatePot(potId, { perPersonCap: Number(cap), vendorIds }), (r: any) => { toast({ text: `${plural(r.reissued, 'card', 'cards')} re-issued with the new rules`, tone: 'good' }); onDone?.() }) }}>
      <p className="hint">Saving signs new cards for everyone in {pot.team}{signer ? ` with ${signer}'s head key` : ''}. Tempo enforces the new rules on the next payment.</p>
      <label>Monthly limit per person<div className="money-in"><span>$</span><input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>
      <fieldset className="check-grid"><legend>Approved vendors</legend>{s.vendors.map((v) => <label key={v.id} className="check"><input type="checkbox" checked={vendorIds.includes(v.id)} onChange={() => toggle(v.id)} />{v.name}</label>)}</fieldset>
      <button className="btn primary" disabled={!!busy || !Number(cap) || !vendorIds.length}>{busy === 'rules' ? 'Signing cards…' : 'Save and re-issue cards'}</button>
    </form>
  )
}

function TopUpRequest({ s, potId, busy, run, toast, onDone }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'> & { potId: string; onDone?: () => void }) {
  const [amount, setAmount] = useState('500')
  const [note, setNote] = useState('Team offsite')
  const pot = s.pots.find((p) => p.id === potId)!
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run('topup', () => api.topupRequest(potId, Number(amount), note), () => { toast({ text: 'Sent to Finance', tone: 'good' }); onDone?.() }) }}>
      <p className="hint">Only Finance can move money into {pot.team}. They'll see this on their home screen.</p>
      <div className="two"><label>Amount<div className="money-in"><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div></label><label>What for<input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} /></label></div>
      <button className="btn primary" disabled={!!busy || !Number(amount)}>Send request</button>
    </form>
  )
}

function InvitePerson({ s, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'>) {
  const isFinance = s.auth?.role === 'admin'
  const myTeam = s.people.find((p) => p.id === s.auth?.personId)?.team
  const teams = isFinance ? s.pots : s.pots.filter((p) => p.id === myTeam)
  const [name, setName] = useState('Nora Patel')
  const [title, setTitle] = useState('Brand Designer')
  const [team, setTeam] = useState(teams[0]?.id ?? '')
  const [role, setRole] = useState<'employee' | 'contractor'>('employee')
  const [salary, setSalary] = useState('3600')
  const [link, setLink] = useState('')
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run('invite', () => api.invite({ name, role, title, team, salary: isFinance && role === 'employee' ? Number(salary) : undefined }), (r: any) => { setLink(`${location.origin}${r.inviteLink}`); toast({ text: 'Invite link ready', tone: 'good' }) }) }}>
      <p className="hint">They open the link, turn on Face ID, and their phone becomes their {role === 'employee' ? 'card' : 'invoice inbox'}. {role === 'employee' ? 'The card is signed by the department head.' : ''}</p>
      <div className="two"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label></div>
      <div className="two"><label>Department<select value={team} onChange={(e) => setTeam(e.target.value)}>{teams.map((p) => <option key={p.id} value={p.id}>{p.team}</option>)}</select></label><label>Role<select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'contractor')}><option value="employee">Employee</option><option value="contractor">Contractor</option></select></label></div>
      {isFinance && role === 'employee' && <label>Monthly salary<div className="money-in"><span>$</span><input inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>}
      {link && <p className="hint">Share this link: {link}</p>}
      <button className="btn primary" disabled={!!busy || !name || !team}>Create invite</button>
    </form>
  )
}

function CompanyRules({ s, busy, run, toast }: Pick<Ctx, 's' | 'busy' | 'run' | 'toast'>) {
  const [threshold, setThreshold] = useState(String(s.company.financeApprovalThreshold))
  const [vendorName, setVendorName] = useState('Canva')
  const [vendorCat, setVendorCat] = useState('Design')
  return (
    <section className="panel">
      <SectionTitle title="Company rules" sub="Rules Teampot checks before anything reaches Tempo." />
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run('rule', () => api.financeRule(Number(threshold)), () => toast({ text: 'Finance limit saved', tone: 'good' })) }}>
        <label className="grow">Payments over this need Finance<div className="money-in"><span>$</span><input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>
        <button className="btn small ghost" disabled={!!busy || !Number(threshold)}>Save</button>
      </form>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run('vendor', () => api.vendor({ name: vendorName, category: vendorCat }), () => toast({ text: `${vendorName} added. Heads can now put it on their cards.`, tone: 'good' })) }}>
        <label className="grow">New vendor<input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></label>
        <label className="grow">Category<input value={vendorCat} onChange={(e) => setVendorCat(e.target.value)} /></label>
        <button className="btn small ghost" disabled={!!busy || !vendorName}>Add</button>
      </form>
    </section>
  )
}

function Feed({ s, filter, compact, openReceipt }: { s: State; filter?: (a: Activity) => boolean; compact?: boolean; openReceipt: (id: string) => void }) {
  const items = useMemo(() => (filter ? s.activity.filter(filter) : s.activity).slice(0, compact ? 6 : 14), [s.activity, filter, compact])
  if (!items.length) return <Empty text="Nothing yet." />
  return <ul className="feed">{items.map((a) => {
    const body = <><span className="dot" aria-hidden>{feedIcon(a.kind)}</span><span className="grow"><b>{a.title}</b><small>{feedDetail(a)} · {ago(a.at)}</small></span>{a.amount !== undefined && <span className="num">{money(a.amount)}</span>}</>
    return <li key={a.id} className={`k-${a.kind}`}>{a.receipt ? <button className="feed-row" aria-label={`${a.title}, open receipt`} onClick={() => openReceipt(a.id)}>{body}<svg className="chev" viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" /></svg></button> : <div className="feed-row">{body}</div>}</li>
  })}</ul>
}

function feedIcon(kind: Activity['kind']) {
  const d: Record<string, string> = {
    payday: 'M6 7h12v10H6zM12 10v4M10 12h4',
    spend: 'M4 7h16v10H4zM4 11h16',
    paid: 'm5 13 4 4L19 7',
    approved: 'm5 13 4 4L19 7',
    held: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    returned: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    declined: 'M7 7l10 10M17 7 7 17',
    invoice: 'M7 3h8l4 4v14H7zM10 13h6M10 17h6',
    invest: 'm4 17 5-5 3 3 7-8',
    earn: 'M12 3v18M7 8h7a3 3 0 0 1 0 6H8',
    perk: 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z',
    kudos: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
    quarter: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    setup: 'M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
    admin: 'M12 19V5M5 12l7-7 7 7',
    fund: 'M12 19V5M5 12l7-7 7 7',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d[kind] ?? 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'} /></svg>
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
const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>
const Avatar = ({ name, small }: { name: string; small?: boolean }) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className={`av ${small ? 'sm' : ''}`} style={{ background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 50% 30%)` }} aria-hidden>{name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
}
function Shell({ children, compact, app }: { children: ReactNode; compact?: boolean; app?: boolean }) { return <div className={`app ${compact ? 'compact' : ''} ${app ? 'app-shell' : ''}`}>{children}</div> }
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
const KeyIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></svg>
const FaceIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1.2 4.5 1.2 6 0" /></svg>
