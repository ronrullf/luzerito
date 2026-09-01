// sw.js - Service Worker Offline y Manejador de Notificaciones

const CACHE_NAME = "apagon-pwa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/app.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-72.png"
];

// Instalación y precaching de assets esenciales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estrategia Cache-First con fallback de red
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and CDN requests (Tailwind)
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("cdn.tailwindcss.com")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// Recepción de eventos Push remotos
self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : {
        title: "⚠️ Alerta de Racionamiento",
        body: "Tu próximo corte programado inicia pronto. Revisa tus equipos.",
      };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      vibrate: [300, 100, 300],
      tag: data.tag || "apagon-alert",
      renotify: true,
    })
  );
});

// Clic en notificación: abrir / enfocar la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
  );
});
