// app.js - State Machine Architecture para LuzControl con Dexie.js (IndexedDB)

// === CONFIGURACIÓN DE BASE DE DATOS LOCAL ===
const db = new Dexie("LuzControlDB");
db.version(1).stores({
  config: 'id',       // Guardará la configuración global
  checklist: 'id'     // Guardará el estado de las tareas
});

let currentConfig = null;
let activeThemeState = "UNKNOWN";
let stateLoopInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initAppFlow();
});

// ============================================================
// MOD_01: ENTRYPOINT & PERMISSIONS
// ============================================================
async function initAppFlow() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("/sw.js"); } 
    catch (e) { console.error("SW Registration failed", e); }
  }

  // Cargar desde Dexie DB
  await loadConfig();

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  
  if (!currentConfig) {
    document.getElementById("view-onboarding").classList.remove("hidden");
  } else {
    startDashboardMachine();
  }

  document.getElementById("btn-start-onboarding").addEventListener("click", () => {
    document.getElementById("view-onboarding").classList.add("hidden");
    if (!isStandalone) document.getElementById("view-a2hs").classList.remove("hidden");
    else showPermissionModal();
  });

  document.getElementById("btn-dismiss-a2hs").addEventListener("click", () => {
    document.getElementById("view-a2hs").classList.add("hidden");
    showPermissionModal();
  });

  setupPermissionModal();
  initSettingsForm();
  await initChecklist();
  initBottomNav();
  initDeviations();
}

function showPermissionModal() {
  if (!("Notification" in window) || Notification.permission === "granted" || Notification.permission === "denied") {
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
  const btnOpen = document.getElementById("btn-open-perm");

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
// MOD_02: SCHEDULE SETUP & PERSISTENCE (DEXIE)
// ============================================================
async function loadConfig() {
  try {
    const data = await db.config.get('main');
    if (data) currentConfig = data;
  } catch (e) { console.error("Error loading config", e); }
}

async function saveConfig(cfg) {
  currentConfig = cfg;
  await db.config.put({ id: 'main', ...cfg }); // Guarda asíncronamente en IndexedDB
  startDashboardMachine();
  scheduleNotificationsEngine();
}

function initSettingsForm() {
  const form = document.getElementById("settings-form");
  const chips = document.querySelectorAll(".day-chip");
  
  if (currentConfig) {
    document.getElementById("input-start-time").value = currentConfig.startTime;
    document.getElementById("input-end-time").value = currentConfig.endTime;
    chips.forEach(c => {
      if (currentConfig.activeDays.includes(parseInt(c.dataset.day))) c.classList.add("active");
    });
  }

  chips.forEach(chip => {
    chip.addEventListener("click", () => chip.classList.toggle("active"));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = document.getElementById("input-start-time").value;
    const et = document.getElementById("input-end-time").value;
    const active = Array.from(chips).filter(c => c.classList.contains("active")).map(c => parseInt(c.dataset.day));

    if (active.length === 0) return showToast("⚠️ Selecciona al menos un día");
    
    let [sh, sm] = st.split(":").map(Number);
    let [eh, em] = et.split(":").map(Number);
    let diffMins = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMins <= 0) diffMins += 24 * 60; 
    
    const cfg = { startTime: st, endTime: et, activeDays: active, durationHours: (diffMins/60).toFixed(1) };
    await saveConfig(cfg);
    showToast("✅ Horario guardado en IndexedDB");
    
    showView("view-estado");
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("opacity-100", "scale-110"));
    document.querySelector('[data-view="view-estado"]').classList.add("opacity-100", "scale-110");
  });

  document.getElementById("btn-reset-data").addEventListener("click", async () => {
    if(confirm("¿Borrar todos los datos locales?")) {
      await db.delete(); // Elimina toda la base de datos Dexie
      localStorage.clear();
      location.reload();
    }
  });

  document.getElementById("btn-test-push").addEventListener("click", async () => {
    if (Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("🔔 Alarma de Prueba", { body: "El sistema offline está funcionando.", icon: "/icons/icon-192.png" });
    } else {
      showToast("⚠️ Permisos de notificación denegados");
    }
  });
}

// ============================================================
// MOD_03: DASHBOARD ENGINE
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
    if (now > cutStart) targetTime.setDate(targetTime.getDate() + 1);
  }

  const newState = isCutActive ? "SIN_LUZ" : "CON_LUZ";
  if (activeThemeState !== newState) applyTheme(newState);

  const display = document.getElementById("countdown-display");
  const timeDiff = targetTime - now;

  if (timeDiff > 0 && (isActiveDay || isCutActive)) {
    const h = Math.floor(timeDiff / 3600000);
    const m = Math.floor((timeDiff % 3600000) / 60000);
    display.textContent = `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`;
  } else {
    display.textContent = "--h --m";
  }

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
  document.getElementById("btn-ajustar-30").addEventListener("click", async () => {
    if(!currentConfig) return;
    let [sh, sm] = currentConfig.startTime.split(":").map(Number);
    let [eh, em] = currentConfig.endTime.split(":").map(Number);
    
    sm += 30; if (sm >= 60) { sh += 1; sm -= 60; }
    em += 30; if (em >= 60) { eh += 1; em -= 60; }
    
    currentConfig.startTime = `${String(sh).padStart(2,"0")}:${String(sm).padStart(2,"0")}`;
    currentConfig.endTime = `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`;
    
    await saveConfig(currentConfig);
    evaluateDashboardState();
    showToast("⏱️ Horario ajustado +30 min");
  });

  document.getElementById("btn-early-restore").addEventListener("click", async () => {
    if(!currentConfig) return;
    const now = new Date();
    currentConfig.endTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    await saveConfig(currentConfig);
    evaluateDashboardState();
    showToast("✅ Retorno anticipado registrado");
  });

  const btnShare = document.getElementById("btn-share-schedule");
  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      if (!currentConfig) return showToast("⚠️ Configura un horario primero");
      const [sh, sm] = currentConfig.startTime.split(":").map(Number);
      const [eh, em] = currentConfig.endTime.split(":").map(Number);
      const startAmPm = format12H(sh, sm);
      const endAmPm = format12H(eh, em);
      const text = `⚠️ Mi zona tendrá racionamiento eléctrico hoy de ${startAmPm} a ${endAmPm} (${currentConfig.durationHours} horas). Estaré sin conexión en ese bloque.`;
      
      if (navigator.share) {
        try { await navigator.share({ title: 'Mi Horario de Corte', text: text }); } 
        catch (e) { console.error(e); }
      } else {
        navigator.clipboard.writeText(text);
        showToast("📋 Texto copiado al portapapeles");
      }
    });
  }
}

function format12H(h, m) {
  const p = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${p}`;
}

// ============================================================
// MOD_04: PUSH SCHEDULER & CHECKLIST (DEXIE)
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

const defaultTasks = [
  { id: 'chk_phones', label: 'Cargar teléfono y Powerbanks' },
  { id: 'chk_ups', label: 'Conectar Mini UPS del módem' },
  { id: 'chk_bulbs', label: 'Cargar bombillos recargables' },
  { id: 'chk_balance', label: 'Verificar saldo (Digitel/Movistar)' },
  { id: 'chk_protect', label: 'Desconectar protectores AC/Nevera' }
];

async function initChecklist() {
  const container = document.getElementById("checklist-items");
  const form = document.getElementById("form-custom-task");
  const input = document.getElementById("input-custom-task");
  
  const today = new Date().toDateString();
  let stateRec = await db.checklist.get('main');
  
  let tasks = (stateRec && stateRec.date === today) ? stateRec.tasks : [];

  if (tasks.length === 0) {
    tasks = defaultTasks.map(t => ({ ...t, checked: false, isCustom: false }));
    await db.checklist.put({ id: 'main', date: today, tasks });
  }

  function renderTasks() {
    container.innerHTML = "";
    tasks.forEach((task, index) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)] cursor-pointer group";
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "w-5 h-5 rounded-md text-pink-500 focus:ring-pink-500 accent-pink-500";
      checkbox.checked = task.checked;
      checkbox.addEventListener("change", async () => {
        tasks[index].checked = checkbox.checked;
        await db.checklist.put({ id: 'main', date: today, tasks });
      });

      const span = document.createElement("span");
      span.className = "flex-1";
      span.textContent = task.label;
      if(task.checked) span.classList.add("line-through", "opacity-60");

      label.appendChild(checkbox);
      label.appendChild(span);

      if (task.isCustom) {
        const delBtn = document.createElement("button");
        delBtn.innerHTML = "🗑️";
        delBtn.className = "opacity-0 group-hover:opacity-100 transition-opacity text-xs p-1";
        delBtn.onclick = async (e) => {
          e.preventDefault();
          tasks.splice(index, 1);
          await db.checklist.put({ id: 'main', date: today, tasks });
          renderTasks();
        };
        label.appendChild(delBtn);
      }
      container.appendChild(label);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    tasks.push({ id: 'custom_' + Date.now(), label: val, checked: false, isCustom: true });
    await db.checklist.put({ id: 'main', date: today, tasks });
    input.value = "";
    renderTasks();
  });

  renderTasks();
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
