import { useState } from 'react'
import './landing.css'
import './waitlist.css'

const ROLES = ['Finance', 'Team lead', 'Employee', 'Contractor', 'Builder', 'Investor'] as const
const SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+'] as const

export default function Waitlist() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number] | ''>('')
  const [size, setSize] = useState<(typeof SIZES)[number] | ''>('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const source = new URLSearchParams(location.search).get('ref') || undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined, company: company || undefined, role: role || 'Other', size: size || undefined, note: note || undefined, website, source }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const share = `https://x.com/intent/post?text=${encodeURIComponent("I just joined the Teampot waitlist: work money that's actually yours, every team running its own money on Tempo.")}&url=${encodeURIComponent('https://www.teampot.xyz/waitlist')}`

  return (
    <div className="lp wl">
      <header className="lp-nav-wrap">
        <nav className="lp-nav" aria-label="Teampot">
          <a className="lp-brand" href="/" aria-label="Teampot home"><Mark size={18} /><span>teampot</span></a>
          <ul><li><a href="/tour">Tour</a></li><li><a href="/#product">Product</a></li><li><a href="/#keys">How it works</a></li></ul>
          <a className="lp-btn dark sm" href="/app">Open demo</a>
        </nav>
      </header>

      <main className="wl-main">
        <section className="wl-stage" aria-hidden="false">
          <Beams />
          <img className="wl-mark" src="/mark3d.webp" width="1200" height="1200" alt="" />
          <div className="wl-stage-copy">
            <p className="wl-eyebrow"><i /> Waitlist</p>
            <h1>Be first to run your<br />team's money.</h1>
            <ul className="wl-points">
              <li><Ico d="M4 7h16v10H4zM4 11h16" /><span>Cards with limits Tempo enforces</span></li>
              <li><Ico d="M12 3v18M7 8h7a3 3 0 0 1 0 6H8" /><span>Payday for everyone in one payment</span></li>
              <li><Ico d="m4 16 5-5 3 3 7-7" /><span>Hold, spend or invest your pay</span></li>
            </ul>
            <div className="wl-people" aria-label="Built for finance, team heads, employees and contractors">
              {['jordan', 'ava', 'sam', 'mateo'].map((p) => <img key={p} src={`/pfp/${p}.webp`} width="40" height="40" alt="" />)}
              <span>For finance, team heads, employees and contractors</span>
            </div>
          </div>
        </section>

        <section className="wl-card" aria-live="polite">
          {done ? (
            <div className="wl-done">
              <span className="wl-check" aria-hidden><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></span>
              <p className="wl-eyebrow dark">You’re in</p>
              <h2>You’re on the list.</h2>
              <p className="wl-sub">We’ll email <b>{email.trim().toLowerCase()}</b> when Teampot goes live. Until then, the demo is open.</p>
              <div className="wl-actions">
                <a className="lp-btn dark" href="/app">Try the live demo</a>
                <a className="lp-btn light" href={share} target="_blank" rel="noreferrer">Share on X</a>
              </div>
            </div>
          ) : (
            <form className="wl-form" onSubmit={submit} noValidate>
              <p className="wl-eyebrow dark">Get notified</p>
              <h2>Join the waitlist</h2>
              <p className="wl-sub">One email when we go live. No spam.</p>

              <label className="wl-field"><span>Email</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <div className="wl-two">
                <label className="wl-field"><span>Name <em>optional</em></span><input autoComplete="name" placeholder="Ava Chen" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
                <label className="wl-field"><span>Company <em>optional</em></span><input autoComplete="organization" placeholder="Northwind Studio" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} /></label>
              </div>

              <fieldset className="wl-chips"><legend>I’m in</legend>
                {ROLES.map((r) => <button type="button" key={r} aria-pressed={role === r} className={role === r ? 'on' : ''} onClick={() => setRole(role === r ? '' : r)}>{r}</button>)}
              </fieldset>
              <fieldset className="wl-chips"><legend>Team size</legend>
                {SIZES.map((r) => <button type="button" key={r} aria-pressed={size === r} className={size === r ? 'on' : ''} onClick={() => setSize(size === r ? '' : r)}>{r}</button>)}
              </fieldset>

              <label className="wl-field"><span>What would you use it for? <em>optional</em></span><textarea rows={2} placeholder="Team budgets, contractor pay, payday…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} /></label>
              <label className="wl-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>

              {error && <p className="wl-error" role="alert">{error}</p>}
              <button className="wl-submit" disabled={busy}>{busy ? 'Joining…' : 'Join the waitlist'}<Arrow /></button>
              <p className="wl-fine">We only use your email to tell you when Teampot launches.</p>
            </form>
          )}
        </section>
      </main>

      <footer className="wl-foot"><span>Teampot · built on Tempo</span><a href="/">teampot.xyz</a></footer>
    </div>
  )
}

function Beams() {
  const paths = ['M-40 420 C 160 420, 220 260, 420 250', 'M-40 520 C 180 520, 240 470, 470 470', 'M-40 640 C 200 640, 260 700, 520 720', 'M860 120 C 640 140, 560 260, 470 300', 'M900 820 C 700 800, 620 640, 520 600']
  const colors = ['#FF6A3D', '#4C8DFF', '#2FD08A', '#FF6A3D', '#4C8DFF']
  return (
    <svg className="wl-beams" viewBox="0 0 860 860" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {paths.map((d, i) => <path key={`p${i}`} d={d} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="1.5" strokeDasharray="5 9" />)}
      {paths.map((d, i) => <path key={`b${i}`} className="wl-beam" d={d} pathLength={1} fill="none" stroke={colors[i]} strokeWidth="2.5" strokeLinecap="round" style={{ ['--c' as any]: colors[i], animationDelay: `${i * 0.7}s` }} />)}
    </svg>
  )
}

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
const Arrow = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
const Mark = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="55 176 692 444" width={size * 1.56} height={size} aria-hidden>
    <path fill="#000" d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z" />
    <path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z" />
  </svg>
)
