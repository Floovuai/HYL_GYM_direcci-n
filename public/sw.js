const CACHE_PREFIX = "dashcom-static-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// DashCom depende de datos y bundles frescos. El service worker conserva la
// instalacion movil/PWA, pero deja todas las respuestas en manos de la red para
// que cada despliegue se vea tambien en el acceso movil.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: "no-store" }).catch(async () => {
      if (request.mode === "navigate") {
        return new Response("DashCom necesita conexion para cargar la ultima version.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
      return Response.error();
    })
  );
});
