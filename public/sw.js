/* NawaNotas service worker: recursos estáticos em cache e página offline. */
const VERSION = "nawanotas-v3";
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

const OFFLINE_HTML = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem ligação · NawaNotas</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#FFF8EE;color:#1f1a14;font-family:system-ui,sans-serif;text-align:center">
<div><h1 style="font-size:20px">Sem ligação à internet</h1>
<p style="color:#6b5e50;max-width:22rem">As notas são registadas na base de dados. Ligue-se à internet e tente novamente.</p>
<button onclick="location.reload()" style="background:#F28C1B;color:#fff;border:0;border-radius:12px;padding:10px 16px;font-weight:600;font-size:15px">Tentar de novo</button></div>
</body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function ehEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.png" ||
    url.pathname === "/apple-icon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: sempre da rede (dependem da sessão e têm dados privados); sem rede, página offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  // Recursos estáticos com nome versionado: cache primeiro, atualizando em segundo plano.
  if (ehEstatico(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copia = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copia));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
  // Restantes pedidos (API, dados das páginas): rede, sem cache.
});
