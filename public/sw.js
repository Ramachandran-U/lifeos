/*
 * LifeOS service worker — minimal and deliberately conservative.
 *
 * Why it exists:
 *  1. Installability — Chrome/Android require a service worker with a fetch
 *     handler before they'll fire `beforeinstallprompt`, so this is what makes
 *     the one-tap "Install" path in AddToHomeScreenPrompt fire reliably.
 *  2. Offline fallback — a network failure serves a cached copy / the app shell
 *     instead of the browser's dead-dino page.
 *
 * Strategy: NETWORK-FIRST, cache fallback. Always tries the network first, so a
 * fresh deploy is picked up immediately — no stale-app risk (the reason a SW
 * was deferred originally). Only SAME-ORIGIN GETs are touched; API/auth traffic
 * (AI proxy, Supabase, Google) is cross-origin and passes straight through,
 * never cached. Registered from app/+html.tsx.
 */

const CACHE = 'lifeos-runtime-v1';
const APP_SHELL = '/';

self.addEventListener('install', (event) => {
  // Activate this SW as soon as it's installed (don't wait for old tabs).
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(APP_SHELL))
      .catch(() => {
        /* shell precache is best-effort */
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any previous-version caches so an update can't serve stale assets.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept cross-origin requests — the AI proxy, Supabase, Google APIs
  // and CDNs must reach the network untouched (and must never be cached).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Cache successful same-origin app responses for the offline fallback.
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {
            /* quota / opaque — ignore */
          });
        }
        return fresh;
      } catch (err) {
        // Offline: serve a cached copy, or the app shell for a navigation.
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match(APP_SHELL);
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
