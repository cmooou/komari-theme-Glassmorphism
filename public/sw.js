/* Glassmorphism compatibility worker for Komari 1.5+. */
const LEGACY_CACHE_PATTERN = /workbox|precache|komari/i

globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(names =>
        Promise.all(
          names
            .filter(name => LEGACY_CACHE_PATTERN.test(name))
            .map(name => caches.delete(name)),
        ),
      ),
      globalThis.clients.claim(),
    ]),
  )
})

globalThis.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate')
    return

  const url = new URL(event.request.url)
  if (url.origin !== globalThis.location.origin)
    return

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    url.pathname = '/admin/dashboard'
    event.respondWith(Response.redirect(url.href, 302))
  }
})
