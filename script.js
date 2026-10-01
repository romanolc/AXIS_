/* ═══════════════════════════════════════════════════════
   AXIS – script.js
   State, navigation, charts, interactions
═══════════════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────────
const state = {
  machines: {
    1: { on: true, kw: 85, base: 85 },
    2: { on: true, kw: 72, base: 72 },
    3: { on: false, kw: 0, base: 68 },
    4: { on: true, kw: 45, base: 45 },
    5: { on: true, kw: 38, base: 38 },
  },
  sliders: { prod: 80, hvac: 60, light: 100 },
  base: { kwh: 284.7, co2: 142.3, score: 87, cost: 92.4 },
  twin: { kwh: 284.7, co2: 142.3, score: 87, cost: 92.4 },
  optimized: false,
  voiceActive: false,
  currentScreen: 'dashboard',
};

// Allow Enter key on login; authentication is implemented in frontend/js/integration.js.
['login-email', 'login-pass'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

function togglePass() {
  const inp = document.getElementById('login-pass');
  const button = document.querySelector('.eye-btn');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  const visible = inp.type === 'text';
  if (button) { button.setAttribute('aria-pressed', String(visible)); button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha'); }
}

async function showRecoveryNotice(event) {
  event.preventDefault();
  const email = document.getElementById('login-email')?.value.trim();
  if (!email) { showToast('Informe seu e-mail para iniciar a recuperação.'); return false; }
  try {
    await AxisApi.passwordRecovery(email);
    showToast('Se o e-mail estiver cadastrado, você receberá as instruções disponíveis.');
  } catch (error) { showToast(error.message); }
  return false;
}

// ─── NAVIGATION ───────────────────────────────────────────
function goTo(screen) {
  state.currentScreen = screen;

  // Hide all screens
  document.querySelectorAll('.screen-inner').forEach(s => s.classList.remove('active'));
  // Show target
  const target = document.getElementById('screen-' + screen);
  if (target) target.classList.add('active');

  // Update nav items (sidebar)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Update bottom nav
  document.querySelectorAll('.bn-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  // Screen-specific init
  if (screen === 'twin') updateTwinTime();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
  document.querySelector('.menu-btn')?.setAttribute('aria-expanded', String(isOpen));
}

function toggleNotifPanel() {
  const p = document.getElementById('notif-panel');
  const isOpen = p.classList.toggle('hidden') === false;
  document.querySelector('.notif-btn')?.setAttribute('aria-expanded', String(isOpen));
  p.setAttribute('aria-hidden', String(!isOpen));
}

// Close notif panel on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  if (!panel.classList.contains('hidden')) {
    if (!panel.contains(e.target) && !e.target.closest('.notif-btn')) {
      panel.classList.add('hidden');
    }
  }
});

// ─── CHARTS ───────────────────────────────────────────────
function drawMainChart() {
  const container = document.getElementById('main-chart');
  if (!container) return;

  const hours = ['06h','07h','08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'];
  const prod = [80,110,140,180,200,190,170,195,215,220,200,185,240,280,260];
  const com = [40,50,60,80,90,85,75,88,95,98,90,82,100,110,100];
  const alm = [20,25,30,35,38,36,32,38,42,44,40,37,45,50,47];

  const W = container.offsetWidth || 560;
  const H = 200;
  const pad = { top: 10, right: 16, bottom: 30, left: 36 };
  const gW = W - pad.left - pad.right;
  const gH = H - pad.top - pad.bottom;
  const max = 300;

  const pts = (arr) => arr.map((v, i) => {
    const x = pad.left + (i / (arr.length - 1)) * gW;
    const y = pad.top + gH - (v / max) * gH;
    return `${x},${y}`;
  }).join(' ');

  const area = (arr, color) => {
    const first = arr[0], last = arr[arr.length - 1];
    const fx = pad.left, fy = pad.top + gH;
    const lx = pad.left + gW, ly = pad.top + gH;
    return `<polygon points="${fx},${fy} ${pts(arr)} ${lx},${ly}" fill="${color}" opacity="0.08"/>
            <polyline points="${pts(arr)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  };

  // Y axis labels
  let yLabels = '';
  for (let i = 0; i <= 3; i++) {
    const v = Math.round(max * i / 3);
    const y = pad.top + gH - (v / max) * gH;
    yLabels += `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#7a9e92">${v}</text>
                <line x1="${pad.left}" y1="${y}" x2="${pad.left + gW}" y2="${y}" stroke="#e2ede8" stroke-width="1"/>`;
  }

  // X labels
  let xLabels = '';
  [0, 3, 6, 9, 12, 14].forEach(i => {
    const x = pad.left + (i / (hours.length - 1)) * gW;
    xLabels += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#7a9e92">${hours[i]}</text>`;
  });

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    ${yLabels}${xLabels}
    ${area(alm, '#b2f0dc')}
    ${area(com, '#64d6b0')}
    ${area(prod, '#2dd4a0')}
    <circle cx="${pad.left + (14/(hours.length-1))*gW}" cy="${pad.top + gH - (prod[14]/max)*gH}" r="5" fill="#2dd4a0" stroke="white" stroke-width="2"/>
  </svg>`;
}

function drawForecastChart() {
  const container = document.getElementById('forecast-chart');
  if (!container) return;

  const vals = state.forecast?.values?.length ? state.forecast.values : [89, 95, 108, 130, 165, 210, 248, 280, 312, 295, 270, 240];
  const hours = Array.from({ length: vals.length }, (_, i) => i + 3);

  const W = container.offsetWidth || 560;
  const H = 160;
  const pad = { top: 10, right: 16, bottom: 28, left: 36 };
  const gW = W - pad.left - pad.right;
  const gH = H - pad.top - pad.bottom;
  const max = Math.max(350, ...vals) * 1.05;
  const peakValue = Math.max(...vals);
  const peakIndex = vals.indexOf(peakValue);

  const pts = vals.map((v, i) => {
    const x = pad.left + (i / (vals.length - 1)) * gW;
    const y = pad.top + gH - (v / max) * gH;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M${pad.left},${pad.top + gH} ${vals.map((v, i) => {
    const x = pad.left + (i / (vals.length - 1)) * gW;
    const y = pad.top + gH - (v / max) * gH;
    return `L${x},${y}`;
  }).join(' ')} L${pad.left + gW},${pad.top + gH} Z`;

  const gradId = 'fc_' + Date.now();

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4a0" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#2dd4a0" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + gH}" stroke="#e2ede8" stroke-width="1"/>
    <line x1="${pad.left}" y1="${pad.top + gH}" x2="${pad.left + gW}" y2="${pad.top + gH}" stroke="#e2ede8" stroke-width="1"/>
    <path d="${areaPath}" fill="url(#${gradId})"/>
    <polyline points="${pts}" fill="none" stroke="#2dd4a0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pad.left + (peakIndex/(vals.length-1))*gW}" cy="${pad.top + gH - (peakValue/max)*gH}" r="5" fill="#ef4444" stroke="white" stroke-width="2"/>
    <text x="${pad.left + (peakIndex/(vals.length-1))*gW}" y="${pad.top + gH - (peakValue/max)*gH - 10}" text-anchor="middle" font-size="9" fill="#ef4444" font-weight="700">PICO</text>
    ${[0, 3, 6, 9, 12].filter(i => i < vals.length).map(i => {
      const x = pad.left + (i / (vals.length - 1)) * gW;
      return `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#7a9e92">${hours[i]}h</text>`;
    }).join('')}
  </svg>`;
}

function drawHistoryChart() {
  const container = document.getElementById('history-chart');
  if (!container) return;

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const vals2024 = [5200, 5100, 4900, 5000, 5300, 5100];
  const vals2025 = [4200, 3820, 4100, 3950, 4050, 3900];

  const W = container.offsetWidth || 400;
  const H = 140;
  const pad = { top: 10, right: 16, bottom: 28, left: 36 };
  const gW = W - pad.left - pad.right;
  const gH = H - pad.top - pad.bottom;
  const max = 6000;
  const bW = (gW / months.length) * 0.35;

  const bars = months.map((m, i) => {
    const x = pad.left + (i / months.length) * gW + (gW / months.length) * 0.1;
    const h24 = (vals2024[i] / max) * gH;
    const h25 = (vals2025[i] / max) * gH;
    const y24 = pad.top + gH - h24;
    const y25 = pad.top + gH - h25;
    return `
      <rect x="${x}" y="${y24}" width="${bW}" height="${h24}" rx="3" fill="#e2ede8"/>
      <rect x="${x + bW + 3}" y="${y25}" width="${bW}" height="${h25}" rx="3" fill="url(#hg)"/>
      <text x="${x + bW + 1.5}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#7a9e92">${m}</text>
    `;
  }).join('');

  const gradId = 'hg';
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4a0"/>
        <stop offset="100%" stop-color="#0a9e72"/>
      </linearGradient>
    </defs>
    <line x1="${pad.left}" y1="${pad.top + gH}" x2="${pad.left + gW}" y2="${pad.top + gH}" stroke="#e2ede8" stroke-width="1"/>
    ${bars}
    <text x="${pad.left - 6}" y="${pad.top + 4}" text-anchor="end" font-size="9" fill="#7a9e92">6k</text>
    <text x="${pad.left - 6}" y="${pad.top + gH/2 + 4}" text-anchor="end" font-size="9" fill="#7a9e92">3k</text>
    <rect x="${pad.left}" y="${H-18}" width="10" height="8" rx="2" fill="#e2ede8"/>
    <text x="${pad.left + 14}" y="${H-11}" font-size="9" fill="#7a9e92">2024</text>
    <rect x="${pad.left + 50}" y="${H-18}" width="10" height="8" rx="2" fill="#2dd4a0"/>
    <text x="${pad.left + 64}" y="${H-11}" font-size="9" fill="#7a9e92">2025</text>
  </svg>`;
}

// ─── LIVE CLOCK ───────────────────────────────────────────
function startLiveClock() {
  const update = () => {
    const now = new Date();
    const t = now.toLocaleTimeString('pt-BR');
    const el = document.getElementById('live-time');
    const tw = document.getElementById('twin-time');
    if (el) el.textContent = `Atualizado às ${t}`;
    if (tw) tw.textContent = t;
  };
  update();
  setInterval(update, 1000);
}

function updateTwinTime() {
  const el = document.getElementById('twin-time');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}

// ─── KPI PULSE ────────────────────────────────────────────
function pulseCard(el) {
  el.style.transform = 'scale(.97)';
  setTimeout(() => { el.style.transform = ''; }, 150);
}

// ─── DIGITAL TWIN ─────────────────────────────────────────
function updateMachineVisual(id) {
  const m = state.machines[id];
  m.on = !m.on;
  m.kw = m.on ? m.base : 0;

  const el = document.getElementById('mach-' + id);
  const btn = el.querySelector('.mach-toggle');
  const kwEl = document.getElementById('mach-' + id + '-kw');
  const visual = el.querySelector('.mach-visual');

  if (m.on) {
    el.classList.remove('off');
    btn.classList.add('on');
    btn.textContent = 'ON';
    visual.classList.add('active');
    const glow = document.createElement('div');
    glow.className = 'mach-glow';
    if (!visual.querySelector('.mach-glow')) visual.appendChild(glow);
  } else {
    el.classList.add('off');
    btn.classList.remove('on');
    btn.textContent = 'OFF';
    visual.classList.remove('active');
    const glow = visual.querySelector('.mach-glow');
    if (glow) glow.remove();
  }

  kwEl.textContent = m.kw + ' kW';
}

function updateSlider(spanId, val, unit) {
  document.getElementById(spanId).textContent = val + unit;
}

function setScenario(s, btn) {
  document.querySelectorAll('.scen-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const sliders = {
    atual: { prod: 80, hvac: 60, light: 100 },
    otimizado: { prod: 60, hvac: 40, light: 70 },
    critico: { prod: 100, hvac: 100, light: 100 },
  };

  const cfg = sliders[s];
  const setPair = (slId, spanId, v) => {
    const el = document.getElementById(slId);
    if (el) { el.value = v; }
    document.getElementById(spanId).textContent = v + '%';
  };

  setPair('sl-prod', 'sl1-val', cfg.prod);
  setPair('sl-hvac', 'sl2-val', cfg.hvac);
  setPair('sl-light', 'sl3-val', cfg.light);

  if (s === 'otimizado') {
    [1, 2, 4, 5].forEach(id => { if (!state.machines[id].on) return; });
    if (state.machines[3].on) toggleMachine(3);
    if (state.machines[5].on) toggleMachine(5);
  } else if (s === 'critico') {
    [1, 2, 3, 4, 5].forEach(id => { if (!state.machines[id].on) toggleMachine(id); });
  } else {
    // restore atual
    if (!state.machines[1].on) toggleMachine(1);
    if (!state.machines[2].on) toggleMachine(2);
    if (state.machines[3].on) toggleMachine(3);
    if (!state.machines[4].on) toggleMachine(4);
    if (!state.machines[5].on) toggleMachine(5);
  }

  recalcTwin();
}

// ─── INSIGHTS ─────────────────────────────────────────────
function applyInsightVisual(e, msg) {
  e.stopPropagation();
  const card = e.target.closest('.insight-card');
  card.style.opacity = '.4';
  card.style.pointerEvents = 'none';
  showToast('✅ ' + msg);
}

function expandInsight(card) {
  // subtle pulse
  card.style.transform = 'scale(.98)';
  setTimeout(() => { card.style.transform = ''; }, 150);
}

// ─── ACCESSIBILITY ────────────────────────────────────────
function toggleContrast() {
  const on = document.getElementById('toggle-contrast').checked;
  document.body.classList.toggle('high-contrast', on);
  showToast(on ? '🌑 Alto contraste ativado' : '☀️ Alto contraste desativado');
}

function toggleLargeFont() {
  const on = document.getElementById('toggle-font').checked;
  document.body.classList.toggle('large-font', on);
  showToast(on ? '🔤 Fonte grande ativada' : '🔤 Fonte normal restaurada');
}

function toggleSimple() {
  const on = document.getElementById('toggle-simple').checked;
  // Hide chart areas and secondary elements
  document.querySelectorAll('.chart-area, .forecast-chart, .history-chart, .kpi-sparkline, .kpi-bar-wrap, .brain-ring').forEach(el => {
    el.style.display = on ? 'none' : '';
  });
  showToast(on ? '🧩 Modo simplificado ativado' : '🧩 Modo completo restaurado');
}

function toggleMotion() {
  const on = document.getElementById('toggle-motion').checked;
  document.body.classList.toggle('no-motion', on);
  showToast(on ? '⏸ Animações desativadas' : '▶️ Animações ativadas');
}

let voiceUtter = null;
function toggleVoice() {
  const btn = document.getElementById('btn-voice');
  const wave = document.getElementById('voice-wave');

  if (!('speechSynthesis' in window)) {
    showToast('⚠️ Leitura de voz não suportada neste navegador');
    return;
  }

  if (state.voiceActive) {
    window.speechSynthesis.cancel();
    state.voiceActive = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4z" stroke="currentColor" stroke-width="1.5"/><path d="M8 12a4 4 0 008 0M12 16v4M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Iniciar leitura`;
    wave.classList.add('hidden');
    return;
  }

  const text = document.getElementById('voice-text').textContent;
  voiceUtter = new SpeechSynthesisUtterance(text);
  voiceUtter.lang = 'pt-BR';
  voiceUtter.rate = 0.9;
  voiceUtter.onend = () => {
    state.voiceActive = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4z" stroke="currentColor" stroke-width="1.5"/><path d="M8 12a4 4 0 008 0M12 16v4M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Iniciar leitura`;
    wave.classList.add('hidden');
  };

  window.speechSynthesis.speak(voiceUtter);
  state.voiceActive = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6h12v12H6z" fill="currentColor"/></svg> Parar leitura`;
  wave.classList.remove('hidden');
}

// ─── SETTINGS ─────────────────────────────────────────────
function saveSettings() {
  showToast('✅ Configurações salvas com sucesso');
}

// ─── TOAST ────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ─── RESIZE ───────────────────────────────────────────────
window.addEventListener('resize', () => {
  drawMainChart();
  drawForecastChart();
  drawHistoryChart();
});

// ─── CSS ANIMATIONS ───────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-out {
    to { opacity: 0; transform: scale(.96); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

// ─── INPUT RANGE STYLING ──────────────────────────────────
document.querySelectorAll('input[type=range]').forEach(r => {
  r.addEventListener('input', function() {
    const pct = ((this.value - this.min) / (this.max - this.min)) * 100;
    this.style.background = `linear-gradient(90deg, var(--green-primary) ${pct}%, var(--green-light) ${pct}%)`;
  });
  // init
  const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
  r.style.background = `linear-gradient(90deg, var(--green-primary) ${pct}%, var(--green-light) ${pct}%)`;
});
