const CACHE_NAME = 'telecloud-v1'
const STATIC_CACHE = 'telecloud-static-v1'

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/login',
]

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch - streaming proxy for Telegram files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Stream API - proxy through with range support
  if (url.pathname.includes('/api/files/') && url.pathname.includes('/stream')) {
    event.respondWith(fetch(event.request))
    return
  }

  // API routes - network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        }
        return response
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/') || new Response('Offline - TeleCloud', {
            headers: { 'Content-Type': 'text/html' }
          })
        }
      })
    })
  )
})
