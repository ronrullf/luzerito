// app.js - State Machine Architecture para LuzControl

// === STATE MACHINE VARIABLES ===
const STORAGE_KEY = "luzcontrol-config-v2";
const CHECKLIST_KEY = "luzcontrol-checklist";

let currentConfig = null; // { startTime: "11:00", endTime: "16:00", activeDays: [1, 3, 5], durationHours: 5 }
let activeThemeState = "UNKNOWN"; // "CON_LUZ" o "SIN_LUZ"
let stateLoopInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initAppFlow();
});

// ============================================================
// MOD_01: ENTRYPOINT & PERMISSIONS
// ============================================================
async function initAppFlow() {
  // 1. Service worker init
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      console.error("SW Registration failed", e);
    }
  }

  // 2. Load Config from LocalStorage
  loadConfig();

  // 3. A2HS check vs Standalone
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  
  if (!currentConfig) {
    // Force onboarding
    document.getElementById("view-onboarding").classList.remove("hidden");
  } else {
    // App is ready to run
    startDashboardMachine();
  }

  // Bind Onboarding Start
  document.getElementById("btn-start-onboarding").addEventListener("click", () => {
    document.getElementById("view-onboarding").classList.add("hidden");
    
    // Check A2HS recommendation
    if (!isStandalone) {
      document.getElementById("view-a2hs").classList.remove("hidden");
    } else {
      showPermissionModal();
    }
  });

  document.getElementById("btn-dismiss-a2hs").addEventListener("click", () => {
    document.getElementById("view-a2hs").classList.add("hidden");
    showPermissionModal();
  });

  setupPermissionModal();
  initSettingsForm();
  initChecklist();
  initBottomNav();
  initDeviations();
}

function showPermissionModal() {
  if (!("Notification" in window) || Notification.permission === "granted" || Notification.permission === "denied") {
    // If already decided or unsupported, go to settings
    showView("view-ajustes");
    document.getElementById("bottom-nav").classList.remove("hidden");
  } else {
    document.getElementById("modal-permission").classList.remove("hidden");
  }
}

function setupPermissionModal() {
  const modal = document.getElementById("modal-permission");
  const btnRequest = document.getElementById("btn-request-perm");
  const btnDismiss = document.getElementById("btn-dismiss-perm");
  const btnOpen = document.getElementById("btn-open-perm"); // Bell icon on dashboard

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      if (Notification.permission === "granted") return showToast("✅ Alertas activas");
      modal.classList.remove("hidden");
    });
  }

  btnDismiss.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (!currentConfig) { showView("view-ajustes"); document.getElementById("bottom-nav").classList.remove("hidden"); }
  });

  btnRequest.addEventListener("click", async () => {
    modal.classList.add("hidden");
    if ("Notification" in window) {
      const p = await Notification.requestPermission();
      if (p === "granted") showToast("🔔 Alertas activadas");
    }
    if (!currentConfig) { showView("view-ajustes"); document.getElementById("bottom-nav").classList.remove("hidden"); }
  });
}

// ============================================================
// MOD_02: SCHEDULE SETUP & PERSISTENCE
// ============================================================
function loadConfig() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) currentConfig = JSON.parse(data);
  } catch (e) { console.error("Error loading config"); }
}

function saveConfig(cfg) {
  currentConfig = cfg;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  startDashboardMachine();
  scheduleNotificationsEngine();
}

function initSettingsForm() {
  const form = document.getElementById("settings-form");
  const chips = document.querySelectorAll(".day-chip");
  
  // Pre-fill
  if (currentConfig) {
    document.getElementById("input-start-time").value = currentConfig.startTime;
    document.getElementById("input-end-time").value = currentConfig.endTime;
    chips.forEach(c => {
      if (currentConfig.activeDays.includes(parseInt(c.dataset.day))) c.classList.add("active");
    });
  }

  // Toggle Days
  chips.forEach(chip => {
    chip.addEventListener("click", () => chip.classList.toggle("active"));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const st = document.getElementById("input-start-time").value;
    const et = document.getElementById("input-end-time").value;
    const active = Array.from(chips).filter(c => c.classList.contains("active")).map(c => parseInt(c.dataset.day));

    if (active.length === 0) return showToast("⚠️ Selecciona al menos un día");
    
    // Calc Duration
    let [sh, sm] = st.split(":").map(Number);
    let [eh, em] = et.split(":").map(Number);
    let diffMins = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMins <= 0) diffMins += 24 * 60; // Next day end
    
    const cfg = { startTime: st, endTime: et, activeDays: active, durationHours: (diffMins/60).toFixed(1) };
    saveConfig(cfg);
    showToast("✅ Horario guardado");
    
    showView("view-estado");
    // Ensure Nav is selected properly
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("opacity-100", "scale-110"));
    document.querySelector('[data-view="view-estado"]').classList.add("opacity-100", "scale-110");
  });

  // Utilities
  document.getElementById("btn-reset-data").addEventListener("click", () => {
    if(confirm("¿Borrar todos los datos?")) {
      localStorage.clear();
      location.reload();
    }
  });

  document.getElementById("btn-test-push").addEventListener("click", async () => {
    if (Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("🔔 Alarma de Prueba", { body: "El sistema de notificaciones está funcionando.", icon: "/icons/icon-192.png" });
    } else {
      showToast("⚠️ Permisos de notificación no otorgados");
    }
  });
}

// ============================================================
// MOD_03: DASHBOARD ENGINE & LIVE DEVIATIONS
// ============================================================
function startDashboardMachine() {
  document.getElementById("main-app").classList.remove("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  
  if (stateLoopInterval) clearInterval(stateLoopInterval);
  stateLoopInterval = setInterval(evaluateDashboardState, 1000);
  evaluateDashboardState();
}

function evaluateDashboardState() {
  if (!currentConfig) return;
  
  const now = new Date();
  const todayDay = now.getDay();
  const isActiveDay = currentConfig.activeDays.includes(todayDay);

  let [sh, sm] = currentConfig.startTime.split(":").map(Number);
  let [eh, em] = currentConfig.endTime.split(":").map(Number);

  const cutStart = new Date(now); cutStart.setHours(sh, sm, 0, 0);
  const cutEnd = new Date(now); cutEnd.setHours(eh, em, 0, 0);
  
  // Handle overnight schedules
  if (cutEnd <= cutStart) {
    if (now < cutStart && now < cutEnd) cutStart.setDate(cutStart.getDate() - 1);
    else cutEnd.setDate(cutEnd.getDate() + 1);
  }

  let isCutActive = false;
  let targetTime = cutStart;

  if (isActiveDay && now >= cutStart && now < cutEnd) {
    isCutActive = true;
    targetTime = cutEnd;
  } else if (!isActiveDay || now > cutEnd) {
    // Find next active day start time
    // For simplicity of this UI, we just point to the next cutStart if it's today, or show 00:00
    if (now > cutStart) targetTime.setDate(targetTime.getDate() + 1);
  }

  // Theme Transition logic
  const newState = isCutActive ? "SIN_LUZ" : "CON_LUZ";
  if (activeThemeState !== newState) applyTheme(newState);

  // Update UI Elements
  const display = document.getElementById("countdown-display");
  const timeDiff = targetTime - now;

  if (timeDiff > 0 && (isActiveDay || isCutActive)) {
    const h = Math.floor(timeDiff / 3600000);
    const m = Math.floor((timeDiff % 3600000) / 60000);
    const s = Math.floor((timeDiff % 60000) / 1000);
    display.textContent = `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`;
  } else {
    display.textContent = "--h --m";
  }

  // Setup Card Info
  const startAmPm = format12H(sh, sm);
  const endAmPm = format12H(eh, em);
  document.getElementById("block-time-range").textContent = `${startAmPm} – ${endAmPm}`;
  document.getElementById("block-duration").textContent = `Duración: ${currentConfig.durationHours} horas`;
}

function applyTheme(state) {
  activeThemeState = state;
  const body = document.body;
  const orb1 = document.getElementById("orb-1");
  const orb2 = document.getElementById("orb-2");
  const metaColor = document.getElementById("meta-theme-color");
  const indicator = document.getElementById("energy-indicator");
  const statusLbl = document.getElementById("status-label");
  const subtitle = document.getElementById("card-cut-subtitle");
  const miniOrb = document.getElementById("card-mini-orb");
  const btnEarly = document.getElementById("btn-early-restore");

  if (state === "SIN_LUZ") {
    body.classList.add("theme-dark");
    metaColor.setAttribute("content", "#111827");
    
    orb1.className = "fluid-orb w-64 h-64 bg-gradient-to-tr from-[#667EEA] to-[#764BA2] top-[-30px] right-[-20px] fixed";
    orb2.className = "fluid-orb w-72 h-72 bg-gradient-to-tr from-[#F5576C] to-[#f093fb] top-[240px] left-[-40px] fixed";
    miniOrb.className = "w-12 h-12 rounded-full bg-gradient-to-br from-red-500 via-pink-600 to-purple-500 blur-[6px]";
    
    indicator.className = "energy-dot energy-off";
    statusLbl.textContent = "Sin Servicio Eléctrico";
    subtitle.textContent = "EN APAGÓN";
    btnEarly.classList.remove("hidden");
  } else {
    body.classList.remove("theme-dark");
    metaColor.setAttribute("content", "#F8F9FA");
    
    orb1.className = "fluid-orb w-64 h-64 bg-gradient-to-tr from-[#FFE259] to-[#FFA751] top-[-30px] right-[-20px] fixed";
    orb2.className = "fluid-orb w-72 h-72 bg-gradient-to-tr from-[#FFD6E8] to-[#FF99AC] top-[240px] left-[-40px] fixed";
    miniOrb.className = "w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 blur-[6px]";
    
    indicator.className = "energy-dot energy-on";
    statusLbl.textContent = "Con Suministro Activo";
    subtitle.textContent = "PRÓXIMO CORTE";
    btnEarly.classList.add("hidden");
  }
}

function initDeviations() {
  document.getElementById("btn-ajustar-30").addEventListener("click", () => {
    if(!currentConfig) return;
    let [sh, sm] = currentConfig.startTime.split(":").map(Number);
    let [eh, em] = currentConfig.endTime.split(":").map(Number);
    
    sm += 30; if (sm >= 60) { sh += 1; sm -= 60; }
    em += 30; if (em >= 60) { eh += 1; em -= 60; }
    
    currentConfig.startTime = `${String(sh).padStart(2,"0")}:${String(sm).padStart(2,"0")}`;
    currentConfig.endTime = `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`;
    
    saveConfig(currentConfig);
    evaluateDashboardState();
    showToast("⏱️ Horario ajustado +30 min");
  });

  document.getElementById("btn-early-restore").addEventListener("click", () => {
    if(!currentConfig) return;
    // Early restore logic: temporarily set end time to NOW so the machine flips back to Light
    const now = new Date();
    currentConfig.endTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    saveConfig(currentConfig);
    evaluateDashboardState();
    showToast("✅ Retorno anticipado registrado");
  });
}

function format12H(h, m) {
  const p = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${p}`;
}

// ============================================================
// MOD_04: PUSH SCHEDULER & CHECKLIST
// ============================================================
let timeoutHandles = [];

function scheduleNotificationsEngine() {
  if (Notification.permission !== "granted" || !currentConfig) return;
  
  timeoutHandles.forEach(t => clearTimeout(t));
  timeoutHandles = [];
  
  const now = new Date();
  const isActiveDay = currentConfig.activeDays.includes(now.getDay());
  if(!isActiveDay) return;

  let [sh, sm] = currentConfig.startTime.split(":").map(Number);
  let [eh, em] = currentConfig.endTime.split(":").map(Number);
  
  const cutStart = new Date(now); cutStart.setHours(sh, sm, 0, 0);
  const cutEnd = new Date(now); cutEnd.setHours(eh, em, 0, 0);

  const events = [
    { offsetMs: -120 * 60000, title: "🔋 Carga tus equipos", body: "Conecta teléfono, Powerbanks y UPS", ref: cutStart },
    { offsetMs: -90 * 60000, title: "💡 Iluminación", body: "Verifica bombillos y ventiladores", ref: cutStart },
    { offsetMs: -60 * 60000, title: "📶 Conectividad", body: "Recarga saldo o paga servicios", ref: cutStart },
    { offsetMs: -15 * 60000, title: "⚡ Protección AC", body: "Desconecta protectores y neveras", ref: cutStart },
    { offsetMs: 15 * 60000, title: "🔌 Estabilización", body: "Espera unos minutos antes de reconectar", ref: cutEnd }
  ];

  events.forEach(ev => {
    const fireTime = new Date(ev.ref.getTime() + ev.offsetMs);
    const delay = fireTime.getTime() - now.getTime();
    
    if (delay > 0 && delay < 24 * 3600000) {
      timeoutHandles.push(setTimeout(async () => {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(ev.title, { body: ev.body, icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", vibrate: [200, 100, 200] });
      }, delay));
    }
  });
}

function initChecklist() {
  const cbs = document.querySelectorAll(".checklist-item");
  const state = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}");
  
  cbs.forEach(cb => {
    if (state[cb.id] !== undefined) cb.checked = state[cb.id];
    cb.addEventListener("change", () => {
      state[cb.id] = cb.checked;
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    });
  });

  // Reset check at midnight
  const lastDate = localStorage.getItem(CHECKLIST_KEY+"-date");
  const today = new Date().toDateString();
  if (lastDate !== today) {
    cbs.forEach(cb => { cb.checked = false; state[cb.id] = false; });
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    localStorage.setItem(CHECKLIST_KEY+"-date", today);
  }
}

// ============================================================
// NAVIGATION & TOASTS
// ============================================================
function initBottomNav() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => { t.classList.remove("opacity-100", "scale-110"); t.classList.add("opacity-40"); });
      tab.classList.remove("opacity-40"); tab.classList.add("opacity-100", "scale-110");
      showView(tab.dataset.view);
    });
  });
}

function showView(id) {
  document.querySelectorAll(".view-section").forEach(v => v.classList.add("hidden"));
  const view = document.getElementById(id);
  if (view) view.classList.remove("hidden");
  // FIX: Asegurar que el contenedor principal siempre esté visible al cambiar de vista
  const mainApp = document.getElementById("main-app");
  if (mainApp) mainApp.classList.remove("hidden");
}

function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div"); toast.id = "toast";
    toast.className = "fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl bg-white/90 backdrop-blur-lg shadow-lg text-sm font-semibold text-gray-800 border border-white/60 transition-all duration-300 opacity-0 -translate-y-5";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  setTimeout(() => { toast.classList.remove("opacity-0", "-translate-y-5"); toast.classList.add("opacity-100", "translate-y-0"); }, 10);
  setTimeout(() => { toast.classList.remove("opacity-100", "translate-y-0"); toast.classList.add("opacity-0", "-translate-y-5"); }, 3000);
}
