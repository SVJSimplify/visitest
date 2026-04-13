/* ─────────────────────────────────────────────────────────────
   Visitour Service Worker
   Bump CACHE_VERSION on every deploy that changes the app shell.
───────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'v2.0.1'
const CACHE = 'visitour-' + CACHE_VERSION

const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (!req.url.startsWith('http')) return

  // NEVER cache Supabase calls — they must always hit the network
  if (req.url.includes('supabase.co') || req.url.includes('supabase.in')) return

  // NEVER cache the camera/QR libs from CDNs to avoid stale code
  if (req.url.includes('cdn.jsdelivr.net') || req.url.includes('cdnjs.cloudflare.com')) return

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
        }
        return res
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/')))
  )
})
