import { useCallback, useEffect, useRef, useState } from 'react'
import './tour.css'

// Guided walkthrough: chapters on the left, the live app in a phone on the right.
// Each chapter tells the app (same origin, via postMessage) which role, tab and sheet to show.
type Chapter = { id: string; tag: string; title: [string, string]; text: string; viewer: 'sam' | 'ava' | 'jordan' | 'mateo'; tab: string; task?: string }
const CHAPTERS: Chapter[] = [
  { id: 'money', tag: 'Your money', title: ['Your pay lands here.', 'And stays.'], text: 'Payday arrives in about a second. Hold it in dollars, spend it, or invest it without moving it anywhere.', viewer: 'sam', tab: 'home' },
  { id: 'pay', tag: 'Your card', title: ['Pay from your phone.', 'Tempo checks it.'], text: 'Your department head signed your card with a monthly limit and approved vendors. Anything else, Tempo refuses.', viewer: 'sam', tab: 'home', task: 'pay' },
  { id: 'invest', tag: 'Invest', title: ['Hold it, or grow it.', 'Same app.'], text: 'Buy a slice of a stock with your pay, or send part of every payday in automatically.', viewer: 'sam', tab: 'invest' },
  { id: 'head', tag: 'Head key', title: ['Teams run their money.', 'Inside the frame.'], text: 'Ava holds the Design head key. She signs her team’s cards and approves anything off-list, paid from Design’s own account.', viewer: 'ava', tab: 'home' },
  { id: 'treasury', tag: 'Treasury', title: ['Finance sets the frame.', 'Tempo enforces it.'], text: 'Jordan funds each department, hands out head keys and can take them back. Every key and card has a public record.', viewer: 'jordan', tab: 'teams' },
  { id: 'payday', tag: 'Payday', title: ['Everyone, one payment.', 'In about a second.'], text: 'One payment from the treasury pays the whole company, each line with its own note.', viewer: 'jordan', tab: 'home', task: 'payday' },
]
const DWELL = 7000

export default function Tour() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const [blur, setBlur] = useState(true)
  const [t0, setT0] = useState(() => Date.now())
  const [progress, setProgress] = useState(0)
  const frame = useRef<HTMLIFrameElement | null>(null)
  const lastViewer = useRef<string | null>(null)
  const ch = CHAPTERS[i]
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 64) / 872, window.innerWidth < 980 ? (window.innerWidth - 24) / 418 : 1))
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit)
  }, [])

  // Sign in to the demo as the first role before the phone loads.
  useEffect(() => {
    fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: CHAPTERS[0].viewer }) })
      .finally(() => { try { localStorage.setItem('tp-viewer', CHAPTERS[0].viewer) } catch { /* private mode */ } setReady(true) })
  }, [])

  const drive = useCallback((c: Chapter) => {
    const win = frame.current?.contentWindow
    if (!win) return
    const roleChange = lastViewer.current !== null && lastViewer.current !== c.viewer
    lastViewer.current = c.viewer
    setBlur(true)
    win.postMessage({ type: 'tp-tour', viewer: c.viewer, tab: c.tab, task: c.task ?? null }, location.origin)
    setTimeout(() => setBlur(false), roleChange ? 1300 : 450)
  }, [])

  const go = useCallback((n: number) => { setI((n + CHAPTERS.length) % CHAPTERS.length); setT0(Date.now()); setProgress(0) }, [])

  useEffect(() => { if (ready && frame.current?.contentWindow && lastViewer.current !== null) drive(CHAPTERS[i]) }, [i, ready, drive])

  // Auto-advance with a progress line on the active chapter.
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const p = (Date.now() - t0) / DWELL
      if (p >= 1) go(i + 1)
      else setProgress(p)
    }, 60)
    return () => clearInterval(id)
  }, [paused, t0, i, go])

  // Arrow keys, wheel and swipe move between chapters.
  useEffect(() => {
    let lock = 0
    const step = (d: number) => { const now = Date.now(); if (now - lock < 700) return; lock = now; go(i + d) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1); if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) } }
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 30) step(e.deltaY > 0 ? 1 : -1) }
    let sx = 0
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX }
    const onEnd = (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1) }
    addEventListener('keydown', onKey); addEventListener('wheel', onWheel, { passive: true }); addEventListener('touchstart', onStart, { passive: true }); addEventListener('touchend', onEnd)
    return () => { removeEventListener('keydown', onKey); removeEventListener('wheel', onWheel); removeEventListener('touchstart', onStart); removeEventListener('touchend', onEnd) }
  }, [i, go])

  return (
    <div className="tour">
      <a className="tour-brand" href="/"><TourMark /><span>teampot</span></a>
      <section className="tour-copy" aria-live="polite">
        <p className="tour-eyebrow" key={`e-${ch.id}`}><i /> <span className="mono">{String(i + 1).padStart(2, '0')}</span><em /> <span className="mono">{ch.tag}</span></p>
        <h1 key={`h-${ch.id}`}><Words text={ch.title[0]} /><br /><span className="dim"><Words text={ch.title[1]} delay={0.25} /></span></h1>
        <p className="tour-text" key={`t-${ch.id}`}>{ch.text}</p>
        <ol className="tour-list">
          {CHAPTERS.map((c, n) => (
            <li key={c.id}><button className={n === i ? 'on' : ''} onClick={() => go(n)}>
              <span className="mono">{String(n + 1).padStart(2, '0')}</span><b>{c.tag}</b>
              <span className="line"><span style={{ transform: `scaleX(${n === i ? progress : n < i ? 1 : 0})` }} /></span>
            </button></li>
          ))}
        </ol>
        <div className="tour-controls"><button onClick={() => { setPaused((p) => !p); setT0(Date.now() - progress * DWELL) }}>{paused ? 'Play' : 'Pause'}</button><span className="mono">Scroll, swipe or <kbd>←</kbd> <kbd>→</kbd></span></div>
      </section>
      <div className="tour-stage">
        <div className="tp-phone-box" style={{ width: 418 * scale, height: 872 * scale }}><div className="tp-phone" style={{ transform: `scale(${scale})` }}>
          <div className="tp-phone-status"><span>9:41</span><span className="island" /><span className="sig">●●● ◗</span></div>
          {ready && <iframe ref={frame} title="Teampot app" src="/app?tour=1" onLoad={() => { setTimeout(() => { lastViewer.current = ch.viewer; drive(ch) }, 900) }} className={blur ? 'blurred' : ''} />}
          <span className="home-bar" />
        </div></div>
      </div>
    </div>
  )
}

/** Words blur in one after another, like the reference. */
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return <>{text.split(' ').map((w, n) => <span key={n} className="w" style={{ animationDelay: `${delay + n * 0.07}s` }}>{w}{' '}</span>)}</>
}

const TourMark = () => (
  <svg viewBox="55 176 692 444" width="34" height="22" aria-hidden>
    <path fill="#0B0B0C" d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z" />
    <path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z" />
  </svg>
)
