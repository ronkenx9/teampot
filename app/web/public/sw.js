const CACHE = 'teampot-shell-v4'
const SHELL = ['/', '/app', '/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/join/') || url.pathname.includes('/invite/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return
  // Hashed build files never change: serve them from the cache instantly.
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, copy)) }
      return res
    })))
    return
  }
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((cache) => cache.put(req, copy))
      return res
    }).catch(async () => (await caches.match(req)) || (await caches.match('/offline.html')))
  )
})
