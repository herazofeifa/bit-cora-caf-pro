// Bitácora Café Pro service worker: caches ONLY static build assets (JS/CSS/fonts/images).
// Never caches HTML, API, auth, storage or any request with credentials.
const CACHE = "bcp-assets-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!/^\/assets\/|\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(url.pathname)) return;
  if (req.headers.get("authorization")) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === "basic") c.put(req, res.clone());
    return res;
  }));
});
