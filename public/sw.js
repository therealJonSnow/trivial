// Kill switch — replaces the former Serwist service worker.
//
// The app no longer ships a service worker, but browsers that visited the
// site previously still have the old one registered and will keep serving
// stale, cached content. This self-destroying worker is fetched by those
// browsers on their next update check; it clears all caches, unregisters
// itself, and reloads open tabs so they fetch fresh from the network.
//
// Safe to delete once you're confident no clients are still on the old SW.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
