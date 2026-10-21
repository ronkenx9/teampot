import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './styles.css'
import './glide.css'

// Each page is its own download, so the landing page doesn't ship the app (and the app doesn't ship the landing).
const Workspace = lazy(() => import('./Workspace'))
const App = lazy(() => import('./App'))
const Landing = lazy(() => import('./Landing'))
const Tour = lazy(() => import('./Tour'))
const Waitlist = lazy(() => import('./Waitlist'))
const Stats = lazy(() => import('./Stats'))

const path = window.location.pathname
const isDemoRoute = path === '/demo' || path.startsWith('/demo/') || path.startsWith('/app/invite/') || path.startsWith('/invite/')
const isRealRoute = !isDemoRoute && (path === '/app' || path.startsWith('/app/') || path.startsWith('/join/'))
const isAppRoute = isDemoRoute || isRealRoute
document.documentElement.classList.toggle('teampot-route', isAppRoute)
const Page = isRealRoute ? Workspace : isDemoRoute ? App : path === '/tour' ? Tour : path === '/waitlist' ? Waitlist : path === '/stats' ? Stats : Landing
createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><Page /></Suspense>)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

// Analytics: Vercel Web Analytics (cookie-free) plus Teampot's own page-view counter behind /stats.
// The private stats page itself is never counted; Do Not Track is respected.
if (path !== '/stats' && !path.startsWith('/join/') && !path.includes('/invite/') && navigator.doNotTrack !== '1') {
  inject()
  try { navigator.sendBeacon?.('/api/hit', JSON.stringify({ p: path, r: document.referrer.includes('/join/') || document.referrer.includes('/invite/') ? '' : document.referrer })) } catch { /* best effort */ }
}
