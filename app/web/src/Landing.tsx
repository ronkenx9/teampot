import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './landing.css'

const GITHUB = 'https://github.com/ronkenx9/teampot'
const ARCH = `${GITHUB}/blob/main/ARCHITECTURE.md`
const VERIFIED = `${GITHUB}/blob/main/app/VERIFIED.md`
const EXPLORER = 'https://explore.testnet.tempo.xyz'

// Structure and measurements follow tempo.xyz (see brand/TEMPO_CASE_STUDY.md).
export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav-wrap">
        <nav className="lp-nav" aria-label="Teampot">
          <a className="lp-brand" href="/" aria-label="Teampot home"><PotMark size={18} /><span>teampot</span></a>
          <ul>
            <li><a href="/tour">Tour</a></li>
            <li><a href="#product">Product</a></li>
            <li><a href="#keys">How it works</a></li>
            <li><a href={ARCH}>Architecture</a></li>
            <li><a href={GITHUB}>GitHub</a></li>
          </ul>
          <a className="lp-btn dark sm" href="/app">Open demo</a>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <h1>Work money that's<br />actually yours</h1>
          <p>Your pay, your team's budget and your perks land in one app on Tempo. Spend it, hold it or invest it, while every team runs its own money.</p>
          <div className="lp-actions">
            <a className="lp-btn dark" href="/app">Try the live demo</a>
            <a className="lp-btn light" href="/tour">Take the tour</a>
          </div>
        </section>

        <section className="lp-marquee" aria-label="Tempo features Teampot uses">
          <div className="lp-marquee-track">
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1}>
                {['Access keys', 'Admin keys', 'Face ID passkeys', 'Payday in one payment', 'Memos on every line', 'Stablecoin exchange', 'Public record'].map((t) => <li key={t}>{t}</li>)}
              </ul>
            ))}
          </div>
        </section>

        <LiveStage />

        <Section eyebrow="One app" title={<>Everything work pays you,<br />in one place</>}>
          <div className="lp-cards">
            <UseCase title="Your pay" text="Payday lands in seconds. Keep it in dollars, pay from your phone, or send part of every paycheck into stocks." art={<PayArt />} />
            <UseCase title="Your team's cards" text="Your department head signs your card on Tempo: a monthly limit and the vendors you're allowed to pay." art={<CardArt />} />
            <UseCase title="The company treasury" text="Finance funds each department's own account and runs payday for everyone in one payment." art={<TreasuryArt />} />
          </div>
        </Section>

        <ProductTabs />

        <Section eyebrow="Built on Tempo" title="Rules that hold even if the app doesn't">
          <dl className="lp-stats">
            <Stat value="~1 second" label="Payday for the whole company, one payment on Tempo" />
            <Stat value="3 levels" label="Treasury, department head and card, each a key Tempo enforces" />
            <Stat value="0 overspends" label="A card can't pay past its limit or outside its vendor list" />
          </dl>
        </Section>

        <section className="lp-band">
          <blockquote>“Finance sets the frame.<br />Teams decide. Tempo enforces it.”</blockquote>
          <p>How Teampot works, in one line</p>
        </section>

        <section className="lp-section" id="keys">
          <p className="lp-eyebrow">How it works</p>
          <h2>Every level gets its own key</h2>
          <div className="lp-keys">
            <ol>
              <KeyStep n="Company treasury" text="Finance holds it. It funds departments and pays everyone on payday." />
              <KeyStep n="Department account" text="Each department has its own account. Its balance is its budget." />
              <KeyStep n="Head key" text="Finance gives the head an admin key. The head issues cards, approves requests and pays contractors." />
              <KeyStep n="Cards" text="Signed by the head with a monthly limit and approved vendors. People pay with Face ID." />
            </ol>
            <div className="lp-panel"><KeyTree /></div>
          </div>
        </section>

        <section className="lp-section lp-cta">
          <p className="lp-eyebrow">Start using Teampot</p>
          <h2>See it run on Tempo</h2>
          <div className="lp-cta-grid">
            <article>
              <p className="lp-eyebrow">Demo</p>
              <h3>Try every role</h3>
              <p>Be Finance, a department head, an employee or a contractor. Every action links to its public record.</p>
              <a className="lp-btn dark" href="/app">Try the live demo</a>
            </article>
            <article>
              <p className="lp-eyebrow">Code</p>
              <h3>Read how it's built</h3>
              <p>The architecture, the permission rules, and what we verified on the Tempo testnet.</p>
              <a className="lp-btn light" href={ARCH}>Read the architecture</a>
            </article>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <PotMark size={22} light />
        <div className="lp-foot-cols">
          <div><h4>Product</h4><a href="/app">Live demo</a><a href="#product">Features</a><a href="#keys">How it works</a></div>
          <div><h4>Proof</h4><a href={ARCH}>Architecture</a><a href={VERIFIED}>Verified on Tempo</a><a href={GITHUB}>GitHub</a></div>
          <div><h4>Tempo</h4><a href="https://tempo.xyz">tempo.xyz</a><a href={EXPLORER}>Explorer</a><a href="https://docs.tempo.xyz">Docs</a></div>
        </div>
        <p className="lp-foot-note">Demo company on the Tempo testnet. Test money only.</p>
      </footer>
    </div>
  )
}

const ROLES = [
  { id: 'ava', name: 'Ava', role: 'Department head', shot: '/shots/m-ava-home.webp' },
  { id: 'sam', name: 'Sam', role: 'Employee', shot: '/shots/m-sam-home.webp' },
  { id: 'jordan', name: 'Jordan', role: 'Finance', shot: '/shots/m-jordan-home.webp' },
  { id: 'mateo', name: 'Mateo', role: 'Contractor', shot: '/shots/m-mateo-home.webp' },
] as const

/** The hero stage: the middle phone is the live app (tap around); side phones switch its role. */
function LiveStage() {
  const [ref, on] = useInView<HTMLElement>()
  const [role, setRole] = useState<(typeof ROLES)[number]['id']>('sam')
  const [ready, setReady] = useState(false)
  const [switching, setSwitching] = useState(false)
  const frame = useRef<HTMLIFrameElement | null>(null)
  useEffect(() => {
    if (!on || ready) return
    fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: 'sam' }) })
      .finally(() => { try { localStorage.setItem('tp-viewer', 'sam') } catch { /* private mode */ } setReady(true) })
  }, [on, ready])
  const pick = (id: typeof role) => {
    if (id === role) return
    setRole(id)
    setSwitching(true)
    frame.current?.contentWindow?.postMessage({ type: 'tp-tour', viewer: id, tab: 'home', task: null }, location.origin)
    setTimeout(() => setSwitching(false), 1200)
  }
  const idx = ROLES.findIndex((r) => r.id === role)
  const left = ROLES[(idx + ROLES.length - 1) % ROLES.length]
  const right = ROLES[(idx + 1) % ROLES.length]
  return (
    <section className="lp-stage" ref={ref} aria-label="Try Teampot live">
      <div className="lp-roles" role="tablist" aria-label="Choose a role">
        {ROLES.map((r) => <button key={r.id} role="tab" aria-selected={r.id === role} className={r.id === role ? 'on' : ''} onClick={() => pick(r.id)}><b>{r.name}</b><span>{r.role}</span></button>)}
      </div>
      <figure>
        <button className="lp-side left" onClick={() => pick(left.id)} aria-label={`Switch to ${left.name}, ${left.role}`}><img src={left.shot} width="780" height="1688" alt="" loading="lazy" /></button>
        <div className="lp-live-wrap"><span className="lp-live-tag"><i /> Live · tap around</span><div className={`lp-live ${switching ? 'switching' : ''}`}>
          {ready ? <iframe ref={frame} title="Teampot live demo" src="/app?embed=1" loading="lazy" /> : <img src="/shots/m-sam-home.webp" width="780" height="1688" alt="Sam's home in Teampot" />}
        </div></div>
        <button className="lp-side right" onClick={() => pick(right.id)} aria-label={`Switch to ${right.name}, ${right.role}`}><img src={right.shot} width="780" height="1688" alt="" loading="lazy" /></button>
      </figure>
      <p>The middle phone is the real app on the Tempo testnet. Tap a side phone or a name to switch roles.</p>
    </section>
  )
}

function Section({ eyebrow, title, children, id }: { eyebrow: string; title: ReactNode; children: ReactNode; id?: string }) {
  return <section className="lp-section" id={id}><p className="lp-eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</section>
}

function UseCase({ title, text, art }: { title: string; text: string; art: ReactNode }) {
  return <article className="lp-card"><div className="lp-card-copy"><h3>{title}</h3><p>{text}</p></div><div className="lp-card-art">{art}</div></article>
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="lp-stat"><dd>{value}</dd><dt>{label}</dt></div>
}

function KeyStep({ n, text }: { n: string; text: string }) {
  return <li><h3>{n}</h3><p>{text}</p></li>
}

const TABS = [
  { id: 'pay', title: 'Pay', text: 'Pick a vendor and confirm with Face ID. If it’s not on your card, Tempo refuses it and your head gets the request instead.' },
  { id: 'invest', title: 'Invest', text: 'Buy stocks with your pay, or send a share of every payday automatically. Your shares sit next to your cash.' },
  { id: 'approve', title: 'Approve', text: 'Heads approve off-list payments with their own key. One tap can also add the vendor to everyone’s card.' },
  { id: 'payday', title: 'Payday', text: 'Finance reviews the run and pays everyone in one payment, each line with its own note.' },
] as const

function ProductTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('pay')
  return (
    <section className="lp-section" id="product">
      <p className="lp-eyebrow">Inside Teampot</p>
      <h2>What your money can do</h2>
      <div className="lp-tabs">
        <div className="lp-tab-list" role="tablist" aria-label="Teampot features">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <h3>{t.title}</h3>
              {tab === t.id && <p>{t.text}</p>}
            </button>
          ))}
        </div>
        <div className="lp-panel" role="tabpanel">
          {tab === 'pay' && <MockPay />}
          {tab === 'invest' && <MockInvest />}
          {tab === 'approve' && <MockApprove />}
          {tab === 'payday' && <MockPayday />}
        </div>
      </div>
    </section>
  )
}

/* --- product mocks: small, honest copies of real Teampot screens --- */
function MockPay() {
  return <div className="mock"><div className="mock-head"><span>Design card</span><em className="mock-pill">$555 left</em></div><div className="mock-field"><small>Pay</small><b>Figma</b></div><div className="mock-field"><small>Amount</small><b className="mock-amt">$45.00</b></div><button className="mock-btn" tabIndex={-1}>Confirm with Face ID</button><small className="mock-foot">Tempo checks the limit and the vendor list</small></div>
}
function MockInvest() {
  const bars = [18, 22, 20, 26, 30, 28, 34, 38, 36, 42, 46, 44, 50, 54, 58, 56, 62, 66, 70, 74]
  return <div className="mock"><div className="mock-head"><span>Your money</span><em className="mock-pill green">+3.4% invested</em></div><b className="mock-big">$4,284.12</b><div className="mock-bars">{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div><div className="mock-seg"><span>Buy</span><span className="on">Each payday</span><span>Sell</span></div></div>
}
function MockApprove() {
  return <div className="mock"><div className="mock-head"><span>Waiting for you</span><em className="mock-pill amber">1 request</em></div><div className="mock-row"><span className="mock-av">SO</span><div><b>Sam → PixelVault Stock</b><small>Not on the Design list · $45</small></div></div><div className="mock-two"><button className="mock-btn light" tabIndex={-1}>Return</button><button className="mock-btn" tabIndex={-1}>Approve + add</button></div><small className="mock-foot">Paid with Ava’s head key</small></div>
}
function MockPayday() {
  const lines = [['Ava Chen', '$4,200'], ['Sam Okafor', '$3,600'], ['Priya Nair', '$4,800'], ['Leo Martin', '$3,900']]
  return <div className="mock"><div className="mock-head"><span>Payday</span><em className="mock-pill green">Landed in 1.2s</em></div><ul className="mock-lines">{lines.map(([n, a]) => <li key={n}><span>{n}</span><b>{a}</b><em>Settled</em></li>)}</ul><div className="mock-total"><span>One payment</span><b>$16,500</b></div></div>
}

/* --- line art (Tempo style: thin gray strokes, black nodes), animated --- */
/** Starts an SVG's animations when it scrolls into view (and draws its paths in). */
function useInView<T extends Element>() {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

const LIGHT = { design: '#FF6A3D', eng: '#4C8DFF', mkt: '#2FD08A', ink: '#111' }

/** A beam of light that travels a path; `--dur`/`--d` set its timing. */
const Beam = ({ d, color, dur = 2.8, delay = 0, width = 2 }: { d: string; color: string; dur?: number; delay?: number; width?: number }) =>
  <path className="beam" d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" style={{ ['--c' as any]: color, ['--dur' as any]: `${dur}s`, ['--d' as any]: `${delay}s` }} />

function PayArt() {
  const [ref, on] = useInView<SVGSVGElement>()
  const arc = 'M95 140 C 130 80, 190 80, 225 120'
  return (
    <svg ref={ref} viewBox="0 0 320 200" className={`lp-art ${on ? 'in' : ''}`} aria-hidden>
      <rect x="70" y="30" width="180" height="150" rx="14" fill="#fff" stroke="#D4D4D4" />
      <rect className="trace" x="70" y="30" width="180" height="150" rx="14" pathLength={1} fill="none" stroke={LIGHT.design} strokeWidth="1.5" style={{ ['--c' as any]: LIGHT.design }} />
      <text x="88" y="56" className="lp-art-label">PAYDAY</text>
      <path className="draw" pathLength={1} d={arc} fill="none" stroke="#DADADA" />
      <Beam d={arc} color={LIGHT.mkt} dur={2.6} delay={0.4} />
      <circle cx="95" cy="140" r="3" fill="#fff" stroke="#999" />
      <g className="lit" style={{ ['--c' as any]: LIGHT.mkt, ['--dur' as any]: '2.6s', ['--d' as any]: '0.4s' }}><rect x="198" y="108" width="52" height="20" rx="6" fill="#000" stroke="#000" /><text x="224" y="122" textAnchor="middle" className="lp-art-chip">$3,600</text></g>
      <line x1="95" y1="160" x2="225" y2="160" stroke="#E5E5E5" />
      <text x="95" y="174" className="lp-art-label">LANDED IN ~1S</text>
    </svg>
  )
}

function CardArt() {
  const [ref, on] = useInView<SVGSVGElement>()
  return (
    <svg ref={ref} viewBox="0 0 320 200" className={`lp-art ${on ? 'in' : ''}`} aria-hidden>
      <rect x="70" y="40" width="170" height="104" rx="14" fill="none" stroke="#E6E6E6" />
      <rect x="78" y="54" width="170" height="104" rx="14" fill="none" stroke="#E0E0E0" />
      <g className="deal">
        <rect x="86" y="68" width="170" height="104" rx="14" fill="#fff" stroke="#CFCFCF" />
        <rect className="trace loop" x="86" y="68" width="170" height="104" rx="14" pathLength={1} fill="none" stroke={LIGHT.design} strokeWidth="1.6" style={{ ['--c' as any]: LIGHT.design }} />
        <rect x="102" y="84" width="22" height="5" rx="2.5" fill="#E8552D" />
        <text x="102" y="106" className="lp-art-label">DESIGN CARD · SIGNED BY AVA</text>
        <text x="102" y="132" className="lp-art-big">$600 / month</text>
        <rect x="102" y="146" width="138" height="4" rx="2" fill="#EEE" />
        <rect className="fill" x="102" y="146" width="138" height="4" rx="2" fill="#000" />
      </g>
      <rect x="202" y="160" width="70" height="20" rx="6" fill="#000" />
      <text x="237" y="174" textAnchor="middle" className="lp-art-chip">4 vendors</text>
    </svg>
  )
}

function TreasuryArt() {
  const [ref, on] = useInView<SVGSVGElement>()
  const ys = [40, 100, 160]
  const depts = [['Design', LIGHT.design], ['Engineering', LIGHT.eng], ['Marketing', LIGHT.mkt]] as const
  return (
    <svg ref={ref} viewBox="0 0 320 200" className={`lp-art ${on ? 'in' : ''}`} aria-hidden>
      {ys.map((y, i) => <path key={y} className="draw" style={{ ['--d' as any]: `${i * 0.15}s` }} pathLength={1} d={`M112 100 C 170 100, 170 ${y}, 230 ${y}`} fill="none" stroke="#DADADA" />)}
      {ys.map((y, i) => <Beam key={`b${y}`} d={`M112 100 C 170 100, 170 ${y}, 230 ${y}`} color={depts[i][1]} dur={3} delay={0.6 + i * 0.5} />)}
      <rect x="40" y="88" width="72" height="24" rx="7" fill="#000" />
      <text x="76" y="104" textAnchor="middle" className="lp-art-chip">Treasury</text>
      {depts.map(([t, c], i) => <g key={t} className="node" style={{ ['--d' as any]: `${0.5 + i * 0.15}s` }}><g className="lit" style={{ ['--c' as any]: c, ['--dur' as any]: '3s', ['--d' as any]: `${0.6 + i * 0.5}s` }}><rect x="230" y={ys[i] - 11} width="78" height="22" rx="7" fill="#fff" stroke="#D0D0D0" /></g><text x="269" y={ys[i] + 4} textAnchor="middle" className="lp-art-node">{t}</text></g>)}
    </svg>
  )
}

function KeyTree() {
  const [ref, on] = useInView<SVGSVGElement>()
  const cards = [60, 110, 160, 210, 260]
  const depts = [90, 160, 230]
  const deptMeta = [['Marketing', LIGHT.mkt], ['Design', LIGHT.design], ['Engineering', LIGHT.eng]] as const
  const deptPath = (y: number) => `M130 160 C 180 160, 180 ${y}, 230 ${y}`
  const cardPath = (y: number) => `M361 160 C 400 160, 400 ${y}, 440 ${y}`
  return (
    <svg ref={ref} viewBox="0 0 520 320" className={`lp-tree ${on ? 'in' : ''}`} aria-label="Treasury funds department accounts; each head key signs cards, and Tempo refuses payments outside a card">
      <path className="draw" pathLength={1} d="M30 160 L130 160" stroke="#000" strokeWidth="1.5" fill="none" />
      <Beam d="M30 160 L130 160" color="#fff" dur={3.6} delay={1.4} width={2.5} />
      <circle cx="30" cy="160" r="5" fill="#000" />
      <text x="30" y="190" className="lp-art-node" textAnchor="middle">Treasury</text>
      {depts.map((y, i) => <path key={y} className="draw" style={{ ['--d' as any]: `${0.3 + i * 0.1}s` }} pathLength={1} d={deptPath(y)} fill="none" stroke={i === 1 ? '#000' : '#D6D6D6'} strokeWidth={i === 1 ? 1.5 : 1} />)}
      {depts.map((y, i) => <Beam key={`b${y}`} d={deptPath(y)} color={deptMeta[i][1]} dur={3.6} delay={1.6 + i * 0.35} width={2.2} />)}
      {depts.map((y, i) => <g key={y} className="node" style={{ ['--d' as any]: `${0.6 + i * 0.1}s` }}><g className="lit" style={{ ['--c' as any]: deptMeta[i][1], ['--dur' as any]: '3.6s', ['--d' as any]: `${1.6 + i * 0.35}s` }}><rect x="230" y={y - 13} width="96" height="26" rx="13" fill={i === 1 ? '#000' : '#fff'} stroke={i === 1 ? '#000' : '#D0D0D0'} /></g><text x="278" y={y + 4} textAnchor="middle" className={i === 1 ? 'lp-art-chip' : 'lp-art-node'}>{deptMeta[i][0]}</text></g>)}
      <path className="draw" style={{ ['--d' as any]: '0.9s' }} pathLength={1} d="M326 160 L351 160" stroke="#000" strokeWidth="1.5" fill="none" />
      <g className="lit" style={{ ['--c' as any]: LIGHT.design, ['--dur' as any]: '3.6s', ['--d' as any]: '2.3s' }}><circle cx="356" cy="160" r="5" fill="#fff" stroke="#000" strokeWidth="1.5" /></g>
      <text x="356" y="140" className="lp-art-node" textAnchor="middle">Head key</text>
      {cards.map((y, i) => <path key={y} className="draw" style={{ ['--d' as any]: `${1.1 + i * 0.06}s` }} pathLength={1} d={cardPath(y)} fill="none" stroke={i === 2 ? '#000' : '#DADADA'} strokeWidth={i === 2 ? 1.5 : 1} />)}
      {cards.map((y, i) => i !== 4 && <Beam key={`c${y}`} d={cardPath(y)} color={LIGHT.design} dur={3.6} delay={2.5 + i * 0.12} />)}
      {cards.map((y, i) => <g key={y} className="node" style={{ ['--d' as any]: `${1.3 + i * 0.06}s` }}>{i !== 4 ? <g className="lit" style={{ ['--c' as any]: LIGHT.design, ['--dur' as any]: '3.6s', ['--d' as any]: `${2.5 + i * 0.12}s` }}><rect x="440" y={y - 9} width="44" height="18" rx="5" fill={i === 2 ? '#000' : '#fff'} stroke={i === 2 ? '#000' : '#D0D0D0'} /></g> : <rect x="440" y={y - 9} width="44" height="18" rx="5" fill="#fff" stroke="#D0D0D0" />}</g>)}
      <rect x="446" y="158.5" width="10" height="3" rx="1.5" fill="#E8552D" />
      {/* a payment off the card's list: the red beam stops and Tempo refuses it */}
      <path className="beam stop" d="M361 160 C 400 160, 400 260, 440 260" pathLength={1} fill="none" stroke="#FF3B30" strokeWidth={2.2} strokeLinecap="round" style={{ ['--c' as any]: '#FF3B30', ['--dur' as any]: '3.6s', ['--d' as any]: '2.9s' }} />
      <g className="refuse" style={{ ['--dur' as any]: '3.6s', ['--d' as any]: '2.9s' }}><circle cx="416" cy="232" r="9" fill="#fff" stroke="#FF3B30" /><path d="M412 228 l8 8 M420 228 l-8 8" stroke="#FF3B30" strokeWidth="1.6" /><text x="416" y="254" textAnchor="middle" className="lp-art-refuse">Refused by Tempo</text></g>
      <text x="462" y="300" className="lp-art-node" textAnchor="middle">Cards</text>
      <line x1="30" y1="300" x2="490" y2="300" stroke="#E6E6E6" />
    </svg>
  )
}

const PotMark = ({ size = 26, light }: { size?: number; light?: boolean }) => (
  <svg viewBox="55 176 692 444" width={size * 1.56} height={size} aria-hidden>
    <path fill={light ? '#fff' : '#000'} d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z" />
    <path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z" />
  </svg>
)
