const CACHE = 'teampot-shell-v2'
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
  if (new URL(req.url).pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((cache) => cache.put(req, copy))
      return res
    }).catch(async () => (await caches.match(req)) || (await caches.match('/offline.html')))
  )
})
