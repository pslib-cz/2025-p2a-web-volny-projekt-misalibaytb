const CACHE_NAME = "misaliba-pages-v2";
const PRECACHE_ROUTES = ["/", "/skills", "/projects"];

const normalizeRoute = (url) => {
  if (url.origin !== self.location.origin) {
    return null;
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  return PRECACHE_ROUTES.includes(pathname) ? pathname : null;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ROUTES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const route = normalizeRoute(new URL(event.request.url));

  if (!route) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(route);

      const refreshCache = fetch(route, {
        credentials: "same-origin",
      })
        .then((response) => {
          if (response.ok) {
            cache.put(route, response.clone());
          }

          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse ?? refreshCache;
    }),
  );
});
