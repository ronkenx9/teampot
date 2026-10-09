import { createRoot } from 'react-dom/client'
import App from './App'
import Landing from './Landing'
import './styles.css'

const path = window.location.pathname
const isAppRoute = path === '/app' || path.startsWith('/app/') || path.startsWith('/invite/')
createRoot(document.getElementById('root')!).render(isAppRoute ? <App /> : <Landing />)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
