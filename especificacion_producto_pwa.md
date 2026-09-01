# Especificación Técnica y de Producto: PWA de Gestión y Prevención de Apagones

---

## 1. Visión del Producto y Propuesta Web App (PWA)

La solución está concebida como una **Progressive Web App (PWA) Mobile-First**, accesible al instante mediante enlace web y capaz de instalarse directamente en la pantalla de inicio del dispositivo móvil sin intermediarios ni descargas pesadas.

El sistema permite al usuario configurar sus bloques observados de racionamiento eléctrico (ejemplo: 11:00 AM a 4:00 PM = 5 horas de corte), generando:
1. **Un temporizador visual reactivo** de tiempo restante con suministro eléctrico.
2. **Alertas Web Push locales y remotas** mediante el `Service Worker`, diseñadas para ejecutarse antes de que caigan las radiobases móviles.
3. **Módulos de afiliación contextual** integrados de forma nativa en la experiencia de contingencia.

### Pilares de la Arquitectura PWA
* **100% Offline-First (Cache Storage + IndexedDB):** Toda la lógica de temporizadores, persistencia de horarios y checklist funciona sin conexión activa a internet.
* **Instalación Inmediata (A2HS):** Cumple con todos los estándares de `manifest.json` y Web API para instalación directa ("Agregar a pantalla de inicio").
* **Bajo Consumo de Datos y Batería:** Peso inicial inferior a 1 MB, renderizado ligero y optimizado para pantallas OLED.

---

## 2. Sistema de Notificaciones Web Push y Gestión de Permisos

### 2.1. Estrategia de Permisos (Permission Priming)
Los navegadores bloquean solicitudes invasivas de notificación sin interacción previa del usuario. La app utiliza un **flujo de dos pasos**:
1. **Pantalla de Consentimiento Contextual (Liquid Glass Modal):** Se explica el beneficio crítico (*"Te avisaremos 2 horas antes del corte para cargar tus equipos"*).
2. **Disparo de la API Nativa:** Al hacer clic en *"Activar Alertas de Respaldo"*, se invoca `Notification.requestPermission()`.

### 2.2. Cronograma de Notificaciones Push Preventivas

| Momento | Título de la Alerta | Contenido de la Notificación | Acción Clave |
| :--- | :--- | :--- | :--- |
| **T - 2 Horas** | 🔋 Carga tus baterías | *"Conecta tu celular, Powerbanks y Mini UPS de router."* | Carga de equipos críticos antes del corte. |
| **T - 1.5 Horas**| 💡 Iluminación y ventilación | *"Verifica bombillos recargables y ventiladores portátiles."* | Preparación de áreas habitables. |
| **T - 1 Hora** | 📶 Datos y transacciones | *"Recarga saldo móvil y gestiona pagos o transferencias pendientes."* | Prevención ante caída de puntos de venta y datos. |
| **T - 15 Min** | ⚡ Protección eléctrica | *"Desconecta nevera, aire acondicionado y computadoras."* | Prevención de daños por caída de tensión. |
| **Retorno +15m**| 🔌 Estabilización de voltaje| *"Espera unos minutos antes de reconectar equipos de alto consumo."* | Protección contra picos residuales. |

---

## 3. Arquitectura Técnica PWA

```
┌──────────────────────────────────────────────────────────────┐
│                    NAVEGADOR / WEBVIEW MÓVIL                 │
│  [UI Liquid Glass] <──> [IndexedDB / LocalStorage]           │
└──────────────────────────────┬───────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────────┐       ┌────────────────────────┐
│ SERVICE WORKER (sw.js)      │       │ NOTIFICATION API       │
│ • Cache-First Assets        │       │ • PushManager (VAPID)  │
│ • Background Sync           │       │ • Local Notification   │
│ • Manejo de eventos offline │       │   Scheduling           │
└─────────────────────────────┘       └────────────────────────┘
```

### Componentes de Infraestructura Web
* **Web App Manifest (`manifest.json`):** Configurado con `display: "standalone"`, `orientation: "portrait"`, y esquema de iconos adaptables.
* **Service Worker (`sw.js`):** Gestiona la caché de recursos estáticos, la recepción de eventos `push` y el disparo de notificaciones nativas del sistema operativo.
* **Base de Datos del Cliente:** `IndexedDB` para horarios complejos y recurrencias; `localStorage` para preferencias y estado del temporizador.

---

## 4. Estrategia de Monetización por Afiliados

La monetización aprovecha enlaces directos de comercio electrónico y pasarelas de pago móvil sin recargar la web app con anuncios invasivos.

* **Sección "Arsenal de Respaldo":** Tarjetas de producto integradas con enlaces UTM de afiliados (Amazon Associates, plataformas de courier internacional, importadores locales).
* **Catálogo Estratégico:**
  * Mini UPS para Routers de Fibra Óptica (12V / 9V).
  * Powerbanks con carga rápida (Power Delivery 20W+).
  * Bombillos LED recargables automáticos con batería de litio interna.
  * Protectores electrónicos de voltaje con retardo de encendido.