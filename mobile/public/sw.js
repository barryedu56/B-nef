/* Service worker de la version installable (PWA) de Bénef, portée /app/.
 * But : que l'app s'ouvre même sans réseau. Les données, elles, sont déjà
 * gardées par l'app (cache des écrans + file d'attente hors ligne) : l'API
 * (/api/) n'est jamais mise en cache ici. */
const CACHE = 'benef-app-v1';
const SCOPE = new URL(self.registration.scope).pathname; // « /app/ »

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SCOPE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  // Pages : le réseau d'abord (toujours la dernière version), sinon l'app en cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE))
    );
    return;
  }

  // Fichiers de l'app (noms qui changent à chaque version) : le cache d'abord.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
