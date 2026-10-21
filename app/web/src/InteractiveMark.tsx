import { useEffect, useId, useRef, useState } from 'react'
import './interactive-mark.css'

export default function InteractiveMark({ variant = 'welcome' }: { variant?: 'welcome' | 'hero' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<ReturnType<typeof import('./markScene').createMarkScene> | null>(null)
  const pose = useRef({ x: -.28, y: .42, open: false })
  const drag = useRef<{ id: number; x: number; y: number; baseX: number; baseY: number; moved: boolean } | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const hint = useId()
  useEffect(() => {
    let cancelled = false
    const fail = () => { engine.current?.dispose(); engine.current = null; setReady(false) }
    import('./markScene').then(({ createMarkScene }) => {
      if (cancelled || !canvas.current) return
      try { engine.current = createMarkScene(canvas.current, fail); setReady(true) } catch { fail() }
    }).catch(fail)
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null }
  }, [])
  const update = () => engine.current?.update(pose.current.x, pose.current.y, pose.current.open)
  const toggle = () => { pose.current.open = !pose.current.open; setOpen(pose.current.open); update() }
  return <div className={`interactive-mark mark-${variant}`}>
    <div className="mark-manipulator" role={ready ? 'button' : 'img'} tabIndex={ready ? 0 : undefined}
      aria-label={ready ? 'Interactive Teampot mark' : 'Teampot chrome mark'} aria-describedby={ready ? hint : undefined} aria-pressed={ready ? open : undefined}
      onPointerDown={event => { if (!ready || event.button !== 0) return; drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, baseX: pose.current.x, baseY: pose.current.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => {
        if (!ready) return
        const active = drag.current
        if (active && active.id === event.pointerId) {
          const dx = event.clientX - active.x, dy = event.clientY - active.y
          if (Math.hypot(dx, dy) > 6) active.moved = true
          if (active.moved) { pose.current.y = Math.max(-1.15, Math.min(1.15, active.baseY + dx * .008)); pose.current.x = Math.max(-.8, Math.min(.65, active.baseX + dy * .006)); update() }
        } else if (event.pointerType === 'mouse' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const box = event.currentTarget.getBoundingClientRect()
          engine.current?.update(pose.current.x + (event.clientY - box.top - box.height / 2) / box.height * .18, pose.current.y + (event.clientX - box.left - box.width / 2) / box.width * .28, pose.current.open)
        }
      }}
      onPointerUp={event => { const active = drag.current; if (!active || active.id !== event.pointerId) return; drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (!active.moved) toggle(); else update() }}
      onPointerCancel={() => { drag.current = null; update() }} onLostPointerCapture={() => { drag.current = null }} onPointerLeave={() => { if (!drag.current) update() }}
      onClick={event => { if (ready && event.detail === 0) toggle() }}
      onKeyDown={event => {
        if (!ready || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', ' '].includes(event.key)) return
        event.preventDefault()
        if (event.key === 'Enter' || event.key === ' ') { toggle(); return }
        if (event.key === 'Home') { pose.current = { x: -.28, y: .42, open: false }; setOpen(false) }
        if (event.key === 'ArrowLeft') pose.current.y = Math.max(-1.15, pose.current.y - .15)
        if (event.key === 'ArrowRight') pose.current.y = Math.min(1.15, pose.current.y + .15)
        if (event.key === 'ArrowUp') pose.current.x = Math.max(-.8, pose.current.x - .12)
        if (event.key === 'ArrowDown') pose.current.x = Math.min(.65, pose.current.x + .12)
        update()
      }}>
      <img src="/mark3d.webp" alt="" className="mark-fallback" style={{ opacity: ready ? 0 : 1 }} />
      <canvas ref={canvas} aria-hidden="true" style={{ opacity: ready ? 1 : 0 }} />
    </div>
    {ready && <span id={hint} className="mark-hint">Drag to turn · Tap to {open ? 'close' : 'open'}<span className="mark-keyboard-hint">. Arrow keys rotate; Enter opens; Home resets.</span></span>}
  </div>
}
