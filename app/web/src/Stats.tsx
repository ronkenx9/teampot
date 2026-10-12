import { useEffect, useState } from 'react'
import './landing.css'
import './waitlist.css'
import './stats.css'

type Row = readonly [string, number]
type Stats = {
  waitlist: { total: number; last24h: number; last7d: number; byRole: Row[]; bySize: Row[]; bySource: Row[]; recent: { at: number; role: string; company: string; size: string }[] }
  traffic: { daily: { day: string; views: number; visitors: number }[]; paths: Row[]; referrers: Row[]; signupsByDay: number[] }
  generatedAt: number
}

const KEY = 'tp-admin-token'
const read = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const keep = (t: string) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch { /* private mode */ } }

export default function StatsPage() {
  const [token, setToken] = useState(read)
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (t = token) => {
    if (!t) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/stats', { headers: { 'x-admin-token': t }, cache: 'no-store' })
      if (r.status === 403) { keep(''); setToken(''); throw new Error('That token didn’t work.') }
      if (!r.ok) throw new Error('Could not load stats.')
      setData(await r.json()); keep(t); setToken(t)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { if (token) load(token) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const daily = data?.traffic.daily ?? []
  const today = daily[daily.length - 1]
  const views14 = daily.reduce((a, d) => a + d.views, 0)
  const peak = Math.max(1, ...daily.map((d) => d.visitors))
  const conv = data && views14 ? (data.waitlist.last7d / Math.max(1, daily.slice(-7).reduce((a, d) => a + d.visitors, 0))) * 100 : 0

  return (
    <div className="lp wl st">
      <header className="lp-nav-wrap">
        <nav className="lp-nav" aria-label="Teampot">
          <a className="lp-brand" href="/" aria-label="Teampot home"><span>teampot</span></a>
          <ul><li><a href="/waitlist">Waitlist</a></li><li><a href="/app">Demo</a></li></ul>
          {token ? <button className="lp-btn light sm" onClick={() => { keep(''); setToken(''); setData(null) }}>Lock</button> : <span />}
        </nav>
      </header>

      <main className="st-main">
        <div className="st-head">
          <div><p className="wl-eyebrow dark"><i /> Private</p><h1>Site and waitlist</h1></div>
          {token && <button className="lp-btn dark sm" disabled={busy} onClick={() => load()}>{busy ? 'Refreshing…' : 'Refresh'}</button>}
        </div>

        {!token ? (
          <form className="st-gate" onSubmit={(e) => { e.preventDefault(); load(draft.trim()) }}>
            <label className="wl-field"><span>Admin token</span><input type="password" autoComplete="current-password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="WAITLIST_TOKEN" /></label>
            {error && <p className="wl-error" role="alert">{error}</p>}
            <button className="wl-submit" disabled={busy || !draft.trim()}>{busy ? 'Checking…' : 'Open stats'}</button>
            <p className="wl-fine">The token is kept in this tab only and sent as a header, never in the URL.</p>
          </form>
        ) : !data ? <p className="st-muted">{error || 'Loading…'}</p> : (
          <>
            <section className="st-kpis">
              <Kpi dark label="On the waitlist" value={data.waitlist.total} sub={`+${data.waitlist.last24h} today · +${data.waitlist.last7d} this week`} />
              <Kpi label="Visitors today" value={today?.visitors ?? 0} sub={`${today?.views ?? 0} page views`} />
              <Kpi label="Page views · 14 days" value={views14} sub={`${daily.reduce((a, d) => a + d.visitors, 0)} daily visitors in total`} />
              <Kpi label="Signup rate · 7 days" value={`${conv.toFixed(1)}%`} sub="signups ÷ daily visitors" />
            </section>

            <section className="st-card">
              <div className="st-card-head"><h2>Last 14 days</h2><span className="st-legend"><i className="v" /> Visitors <i className="s" /> Signups</span></div>
              <div className="st-bars" role="img" aria-label="Daily visitors and signups for the last 14 days">
                {daily.map((d, i) => (
                  <div key={d.day} className="st-bar" title={`${d.day}: ${d.visitors} visitors, ${d.views} views, ${data.traffic.signupsByDay[i]} signups`}>
                    <span className="v" style={{ height: `${(d.visitors / peak) * 100}%` }} />
                    {data.traffic.signupsByDay[i] > 0 && <b className="s">{data.traffic.signupsByDay[i]}</b>}
                    <small>{d.day.slice(8)}</small>
                  </div>
                ))}
              </div>
            </section>

            <div className="st-grid">
              <List title="Who signed up" rows={data.waitlist.byRole} />
              <List title="Team size" rows={data.waitlist.bySize} />
              <List title="Top pages" rows={data.traffic.paths} />
              <List title="Referrers" rows={data.traffic.referrers} empty="No outside referrers yet." />
              <List title="Signup source (?ref=)" rows={data.waitlist.bySource} />
              <section className="st-card">
                <h2>Latest signups</h2>
                {data.waitlist.recent.length ? <ul className="st-list">{data.waitlist.recent.map((r, i) => <li key={i}><span>{r.company || 'No company'} <em>{r.role}{r.size ? ` · ${r.size}` : ''}</em></span><b>{when(r.at)}</b></li>)}</ul> : <p className="st-muted">No signups yet.</p>}
                <p className="st-muted small">Emails stay out of this page. Export the full list from /api/waitlist.csv with the same token.</p>
              </section>
            </div>
            <p className="st-muted small">Updated {when(data.generatedAt)}. Page views are counted without cookies; a visitor is unique per day.</p>
          </>
        )}
      </main>
    </div>
  )
}

function Kpi({ label, value, sub, dark }: { label: string; value: number | string; sub: string; dark?: boolean }) {
  return <div className={`st-kpi ${dark ? 'dark' : ''}`}><span>{label}</span><b>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</b><small>{sub}</small></div>
}

function List({ title, rows, empty = 'Nothing yet.' }: { title: string; rows: Row[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <section className="st-card">
      <h2>{title}</h2>
      {rows.length ? <ul className="st-list">{rows.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b><i style={{ width: `${(v / max) * 100}%` }} /></li>)}</ul> : <p className="st-muted">{empty}</p>}
    </section>
  )
}

const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
