# Especificación Frontend: PWA Liquid Glass UI

---

## 1. Fundamentos Visuales y Sistema de Diseño

El diseño implementa la estética **Liquid Glass**: superficies de vidrio traslúcido (`backdrop-filter: blur`), bordes biselados con gradientes suaves, esquinas ultra redondeadas y orbes de luz ambiental fluidos que reaccionan al estado de energía.

```
┌──────────────────────────────────────────────────────────────┐
│                      CAPAS CSS DEL VIEWPORT                  │
├──────────────────────────────────────────────────────────────┤
│ [Z-30] Modales de Permisos y Floating Bottom Nav             │
│ [Z-20] Tarjetas de Cristal (.liquid-glass-card)              │
│ [Z-10] Orbes de Luz Difuminada (.fluid-orb)                  │
│ [Z-00] Canvas Base (#F8F9FA)                                 │
└──────────────────────────────────────────────────────────────┘
```

### Paleta de Estilos y Clases CSS Base

```css
:root {
  --canvas-bg: #f8f9fa;
  --glass-bg: rgba(255, 255, 255, 0.75);
  --glass-border: rgba(255, 255, 255, 0.9);
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --accent-pink: #ffd6e8;
  --accent-yellow: #fff176;
}

/* Superficie de Cristal Líquido */
.liquid-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
  border-radius: 32px;
}

/* Orbe Líquido Difuminado */
.fluid-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(50px);
  opacity: 0.75;
  pointer-events: none;
}
```

---

## 2. Estructura HTML y Componentes de la Web App

### 2.1. Layout Principal y Temporizador (HTML / Tailwind CSS)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#F8F9FA" />
  <title>Control de Apagones</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#F8F9FA] text-[#111827] min-h-screen relative overflow-x-hidden font-sans antialiased">

  <!-- Orbes Líquidos Ambientales de Fondo -->
  <div class="fluid-orb w-64 h-64 bg-gradient-to-tr from-[#FFE259] to-[#FFA751] top-[-30px] right-[-20px]"></div>
  <div class="fluid-orb w-72 h-72 bg-gradient-to-tr from-[#FFD6E8] to-[#FF99AC] top-[240px] left-[-40px]"></div>

  <!-- Contenedor Móvil Principal -->
  <main class="max-w-md mx-auto min-h-screen px-5 pt-8 pb-28 relative z-10 flex flex-col gap-6">

    <!-- Header / Estado -->
    <header class="flex justify-between items-center">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Resumen del Día</p>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">Estado Eléctrico</h1>
      </div>
      <button id="btn-open-perm" class="w-10 h-10 rounded-full liquid-glass flex items-center justify-center shadow-sm">
        🔔
      </button>
    </header>

    <!-- Métricas Rápidas -->
    <div class="flex items-baseline gap-4">
      <span id="countdown-display" class="text-4xl font-extrabold tracking-tight">04h 25m</span>
      <span class="text-xs font-medium text-gray-500 leading-tight">Tiempo restante<br/>con suministro</span>
    </div>

    <!-- Tarjeta Principal: Bloque de Racionamiento Activo -->
    <section class="liquid-glass p-6 flex flex-col gap-4">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-xs font-semibold text-gray-400">PRÓXIMO CORTE</span>
          <h2 class="text-xl font-bold text-gray-900">01:00 PM – 06:00 PM</h2>
          <p class="text-xs text-gray-500 mt-0.5">Duración estimada: 5 horas</p>
        </div>
        <!-- Orbe miniatura decorativo -->
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 blur-[6px]"></div>
      </div>

      <div class="pt-2 border-t border-white/40 flex justify-between items-center text-xs font-semibold">
        <span class="text-gray-700">¿Cambió la hora en tu zona?</span>
        <button class="px-3 py-1.5 rounded-full bg-white/80 shadow-sm hover:bg-white text-gray-900">Ajustar +30m</button>
      </div>
    </section>

    <!-- Checklist Preventivo Rápido -->
    <section class="liquid-glass p-6 flex flex-col gap-3">
      <h3 class="text-sm font-bold text-gray-900">Preparación Pre-Corte</h3>
      
      <label class="flex items-center gap-3 text-xs font-medium text-gray-700">
        <input type="checkbox" checked class="w-4 h-4 rounded-full text-pink-500 focus:ring-0" />
        <span>Cargar teléfono y Powerbanks</span>
      </label>

      <label class="flex items-center gap-3 text-xs font-medium text-gray-700">
        <input type="checkbox" checked class="w-4 h-4 rounded-full text-pink-500 focus:ring-0" />
        <span>Conectar Mini UPS del módem</span>
      </label>

      <label class="flex items-center gap-3 text-xs font-medium text-gray-700">
        <input type="checkbox" class="w-4 h-4 rounded-full text-pink-500 focus:ring-0" />
        <span>Verificar saldo Digitel / Movistar</span>
      </label>

      <label class="flex items-center gap-3 text-xs font-medium text-gray-700">
        <input type="checkbox" class="w-4 h-4 rounded-full text-pink-500 focus:ring-0" />
        <span>Desconectar protector de nevera</span>
      </label>
    </section>

    <!-- Arsenal de Respaldo (Afiliados) -->
    <section class="liquid-glass p-6 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-gray-900">Arsenal Recomendado</h3>
        <span class="text-[10px] uppercase font-bold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">Ofertas</span>
      </div>

      <a href="https://ejemplo.com/afiliado-mini-ups" target="_blank" rel="noopener noreferrer" 
         class="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-white hover:bg-white transition-all">
        <div>
          <p class="text-xs font-bold text-gray-900">Mini UPS 12V para Router</p>
          <p class="text-[11px] text-gray-500">6 a 8 horas de internet continuo</p>
        </div>
        <span class="text-xs font-bold text-gray-800">$28.00 ➔</span>
      </a>
    </section>

  </main>

  <!-- Modal Liquid Glass: Solicitud de Permisos Push -->
  <aside id="modal-permission" class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 hidden">
    <div class="w-full max-w-sm liquid-glass p-6 bg-white/90 border-white flex flex-col gap-4">
      <div class="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-xl">
        ⚡
      </div>
      <div>
        <h4 class="text-lg font-bold text-gray-950">Activar Alertas Preventivas</h4>
        <p class="text-xs text-gray-600 mt-1">
          Te enviaremos avisos 2 horas y 1 hora antes de que se vaya la luz para que cargues tus baterías y no te quedes incomunicado.
        </p>
      </div>
      <div class="flex gap-2 mt-2">
        <button id="btn-dismiss-perm" class="flex-1 py-3 text-xs font-bold rounded-full bg-gray-100 text-gray-700">
          Ahora no
        </button>
        <button id="btn-request-perm" class="flex-1 py-3 text-xs font-bold rounded-full bg-[#FFD6E8] text-gray-900 shadow-sm">
          Activar Alertas
        </button>
      </div>
    </div>
  </aside>

  <!-- Floating Glass Bottom Navigation -->
  <nav class="fixed bottom-4 left-5 right-5 max-w-md mx-auto liquid-glass px-6 py-3 flex justify-between items-center z-40 bg-white/80">
    <button class="text-lg opacity-100 scale-110">⚡</button>
    <button class="text-lg opacity-40">📅</button>
    <button class="text-lg opacity-40">🎒</button>
    <button class="text-lg opacity-40">⚙️</button>
  </nav>

</body>
</html>
```

---

## 3. Integración de Service Worker y Web Push API

Script modular en JavaScript (`app.js`) para registro del Service Worker y activación de notificaciones:

```javascript
// app.js - Gestión de Registro PWA y Permisos Push

document.addEventListener("DOMContentLoaded", () => {
  initServiceWorker();
  setupPermissionModal();
  initCountdownTimer();
});

// 1. Registro del Service Worker
async function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registrado con alcance:", registration.scope);
    } catch (error) {
      console.error("Fallo al registrar Service Worker:", error);
    }
  }
}

// 2. Control de Modal y Solicitud de Permisos Push
function setupPermissionModal() {
  const modal = document.getElementById("modal-permission");
  const btnOpen = document.getElementById("btn-open-perm");
  const btnDismiss = document.getElementById("btn-dismiss-perm");
  const btnRequest = document.getElementById("btn-request-perm");

  btnOpen.addEventListener("click", () => modal.classList.remove("hidden"));
  btnDismiss.addEventListener("click", () => modal.classList.add("hidden"));

  btnRequest.addEventListener("click", async () => {
    modal.classList.add("hidden");
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        scheduleLocalPushReminder();
      }
    }
  });
}

// 3. Disparo de Notificación Local de Prueba / Confirmación
async function scheduleLocalPushReminder() {
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("🔋 Alertas de Apagón Activadas", {
      body: "Te notificaremos 2 horas antes de tu próximo bloque de racionamiento.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      vibrate: [200, 100, 200],
      tag: "apagon-alert"
    });
  }
}

// 4. Temporizador Simple de Ejemplo
function initCountdownTimer() {
  const display = document.getElementById("countdown-display");
  let totalSeconds = (4 * 3600) + (25 * 60);

  setInterval(() => {
    if (totalSeconds <= 0) return;
    totalSeconds--;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    display.textContent = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }, 1000);
}
```

---

## 4. Archivo del Service Worker (`sw.js`)

```javascript
// sw.js - Service Worker Offline y Manejador de Notificaciones

const CACHE_NAME = "apagon-pwa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/app.js"
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// Recepción de eventos Push remotos
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {
    title: "⚠️ Alerta de Racionamiento",
    body: "Tu próximo corte programado inicia pronto. Revisa tus equipos."
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      vibrate: [300, 100, 300]
    })
  );
});
```