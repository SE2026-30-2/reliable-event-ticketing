// Precache only build assets and the check-in shell. Never cache API responses.
export function checkinPwa() {
  return {
    name: 'eventhub-checkin-pwa',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((name) => /\.(js|css|woff2?)$/.test(name)).map((name) => `/${name}`);
      const version = assets.join('|');
      let hash = 0;
      for (const char of version) hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
      const cache = `eventhub-gate-${hash >>> 0}`;
      this.emitFile({ type: 'asset', fileName: 'checkin-sw.js', source: `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(['/checkin', '/checkin-icon.svg', '/checkin.webmanifest', ...assets])};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('eventhub-gate-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && (url.pathname === '/checkin' || url.pathname === '/checkin/')) {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/checkin'))));
  } else if (ASSETS.includes(url.pathname) && url.pathname !== '/checkin') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname, { ignoreVary: true })) || fetch(event.request)));
  }
});` });
    },
  };
}
