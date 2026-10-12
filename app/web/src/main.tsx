import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import App from './App'
import Landing from './Landing'
import Tour from './Tour'
import Waitlist from './Waitlist'
import Stats from './Stats'
import './styles.css'
import './glide.css'

const path = window.location.pathname
const isAppRoute = path === '/app' || path.startsWith('/app/') || path.startsWith('/invite/')
createRoot(document.getElementById('root')!).render(isAppRoute ? <App /> : path === '/tour' ? <Tour /> : path === '/waitlist' ? <Waitlist /> : path === '/stats' ? <Stats /> : <Landing />)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

// Analytics: Vercel Web Analytics (cookie-free) plus Teampot's own page-view counter behind /stats.
// The private stats page itself is never counted; Do Not Track is respected.
if (path !== '/stats' && navigator.doNotTrack !== '1') {
  inject()
  try { navigator.sendBeacon?.('/api/hit', JSON.stringify({ p: path, r: document.referrer })) } catch { /* best effort */ }
}
