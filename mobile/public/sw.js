/* Service worker de la version installable (PWA) de Bénef, portée /app/.
 * But : que l'app s'ouvre même sans réseau, y compris fermée puis rouverte.
 * Les données, elles, sont gardées par l'app (cache des écrans + file
 * d'attente hors ligne) : l'API (/api/) n'est jamais mise en cache ici.
 *
 * La liste des fichiers et la version sont écrites au build par
 * scripts/pwa-precache.js (sans ce script, en développement : rien d'avance). */
const BUILD = self.__BENEF_PRECACHE__;
const PRECACHE = typeof BUILD === 'object' && BUILD ? BUILD : { version: 'dev', urls: [] };
const CACHE = `benef-app-${PRECACHE.version}`;
const SCOPE = new URL(self.registration.scope).pathname; // « /app/ »

self.addEventListener('install', (event) => {
  // Toute l'app est téléchargée avant d'être activée : la première visite
  // suffit pour pouvoir ensuite l'ouvrir hors connexion.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.urls.length ? PRECACHE.urls : [SCOPE]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Les fichiers des anciennes versions sont effacés.
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

  // Pages : le réseau d'abord (toujours la dernière version), sinon l'app en
  // cache. Délai court : avec un réseau très faible, mieux vaut ouvrir l'app
  // gardée que laisser un écran blanc.
  if (request.mode === 'navigate') {
    event.respondWith(
      timeout(fetch(request), 4000)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          }
          return response;
        })
        .catch(() => caches.match(SCOPE, { ignoreSearch: true }))
    );
    return;
  }

  // Fichiers de l'app (noms qui changent à chaque version) : le cache d'abord.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
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

function timeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
