// Visual primitives for the app, modeled on the "glide" reference: dot-matrix numerals on soft
// gradient cards, pastel stat tiles, mono labels, segmented bars and a sliding segmented control.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/* 5x7 dot font. Narrow glyphs (comma, period, colon) use fewer columns. */
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '00100', '00100', '00100'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  '+': ['000', '000', '010', '111', '010', '000', '000'],
  '-': ['000', '000', '000', '111', '000', '000', '000'],
  ',': ['00', '00', '00', '00', '01', '01', '10'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  ':': ['0', '0', '1', '0', '1', '0', '0'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
}

/** A number drawn in lit dots. Changing `value` re-lights the dots with a small random stagger. */
export function DotNumber({ value, label }: { value: string; label?: string }) {
  const dots = useMemo(() => {
    const out: { x: number; y: number; on: boolean; d: number }[] = []
    let x = 0
    for (const ch of value) {
      const g = GLYPHS[ch] ?? GLYPHS[' ']
      const w = g[0].length
      g.forEach((row, y) => row.split('').forEach((bit, cx) => out.push({ x: x + cx, y, on: bit === '1', d: Math.random() * 0.35 })))
      x += w + 1
    }
    return { out, width: Math.max(1, x - 1) }
  }, [value])
  return (
    <svg className="dotnum" viewBox={`-0.5 -0.5 ${dots.width} 7`} role="img" aria-label={label ?? value} key={value}>
      {dots.out.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={0.38} className={p.on ? 'on' : 'off'} style={p.on ? { animationDelay: `${p.d}s` } : undefined} />)}
    </svg>
  )
}

/** Compact dollar text for dot displays: $3,298 · $16.5K · $2.14M */
export function dotMoney(n: number) {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (a >= 100_000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function Ruler() {
  const ticks = Array.from({ length: 41 }, (_, i) => i)
  return (
    <svg className="ruler" viewBox="0 0 410 24" preserveAspectRatio="none" aria-hidden>
      {ticks.map((i) => <line key={i} x1={i * 10 + 5} x2={i * 10 + 5} y1={i === 20 ? 0 : i % 5 === 0 ? 8 : 12} y2={24} className={i === 20 ? 'mid' : ''} />)}
    </svg>
  )
}

/** Gradient hero card with a label, a dot-matrix value, a sub line and the tick ruler. */
export function Glow({ tone = 'swim', label, value, sub, top, children }: { tone?: 'swim' | 'ember' | 'dusk' | 'deep'; label: string; value: string; sub?: ReactNode; top?: ReactNode; children?: ReactNode }) {
  return (
    <section className={`glow glow-${tone}`}>
      {top && <div className="glow-top">{top}</div>}
      <p className="glow-label">{label}</p>
      <DotNumber value={value} label={`${label}: ${value}`} />
      {sub && <p className="glow-sub" key={String(sub)}>{sub}</p>}
      <Ruler />
      {children}
    </section>
  )
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const i = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div className="seg" role="tablist" aria-label={label} style={{ ['--n' as any]: options.length, ['--i' as any]: i }}>
      <span className="seg-thumb" aria-hidden />
      {options.map((o) => <button key={o.id} role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

/** Hook for a segmented value. */
export function useSeg<T extends string>(initial: T) { return useState<T>(initial) }

export function Tile({ tone, icon, value, unit, label }: { tone: 'lav' | 'sage' | 'butter' | 'peach' | 'sky'; icon: ReactNode; value: string; unit?: string; label: string }) {
  return (
    <div className={`tile tile-${tone}`}>
      <span className="tile-icon" aria-hidden>{icon}</span>
      <b key={value} className="swap">{value}{unit && <small>{unit}</small>}</b>
      <span className="tile-label">{label}</span>
    </div>
  )
}

/** "Up next" card: mono eyebrow, title, white chips, an illustration and a round black action. */
export function NextCard({ eyebrow, title, chips, action, art, tone = 'sky' }: { eyebrow: string; title: string; chips?: ReactNode[]; action?: { label: string; onClick: () => void; icon?: ReactNode }; art?: ReactNode; tone?: 'sky' | 'peach' | 'lav' }) {
  return (
    <section className={`next next-${tone}`}>
      <p className="mono eyebrow-mono">{eyebrow}</p>
      <h3>{title}</h3>
      {chips && <div className="chips-row">{chips.map((c, i) => <span key={i} className="chip-mono">{c}</span>)}</div>}
      {action && <button className="round-btn" aria-label={action.label} onClick={action.onClick}>{action.icon ?? <Arrow />}</button>}
      {art && <div className="next-art" aria-hidden>{art}</div>}
    </section>
  )
}

/** Segmented progress bar: black segments for used, light for the rest, red tick for "now". */
export function SegBar({ used, cap, segments = 12 }: { used: number; cap: number; segments?: number }) {
  const ratio = cap > 0 ? Math.max(0, Math.min(1, used / cap)) : 0
  const lit = Math.round(ratio * segments)
  return (
    <div className="segbar" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.round(used)}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} style={{ animationDelay: `${i * 0.03}s` }} />)}
      <em style={{ left: `${ratio * 100}%` }} />
    </div>
  )
}

/** Column-of-dots chart; one column per value, the highlighted column in red. */
export function DotColumns({ values, highlight, height = 12 }: { values: number[]; highlight?: number; height?: number }) {
  const max = Math.max(1, ...values)
  return (
    <svg className="dotcols" viewBox={`0 0 ${values.length * 2} ${height + 1}`} preserveAspectRatio="none" aria-hidden>
      {values.map((v, x) => {
        const n = Math.max(1, Math.round((v / max) * height))
        return Array.from({ length: height }, (_, k) => <circle key={`${x}-${k}`} cx={x * 2 + 1} cy={height - k} r={0.32} className={k < n ? (x === highlight ? 'hi' : 'on') : 'off'} />)
      })}
    </svg>
  )
}

export const Mono = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={`mono ${className}`}>{children}</span>

export const Arrow = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const Check = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 13 4 4L19 7" /></svg>
export const IconCash = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 9c3-3 5 3 8 0s5 3 8 0M4 15c3-3 5 3 8 0s5 3 8 0" /></svg>
export const IconChart = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m4 16 5-5 3 3 7-7" /></svg>
export const IconCard = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18" /></svg>
export const IconKey = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3" /></svg>
export const IconPeople = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="9" cy="8" r="3" /><path d="M3 19c1-3 3-5 6-5s5 2 6 5M16 5a3 3 0 0 1 0 6M18 14c2 1 3 3 3 5" /></svg>
export const IconClock = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
