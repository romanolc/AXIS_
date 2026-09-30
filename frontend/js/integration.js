(() => {
  let twinTimer;
  let apiPollTimer;

  const brl = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const num = (value, digits = 1) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const setState = (message, kind = '') => {
    const el = document.getElementById('sensor-hub-state');
    if (el) { el.textContent = message; el.className = `data-state ${kind}`; }
  };
  const loading = (button, on) => { if (button) { button.disabled = on; button.classList.toggle('is-loading', on); } };

  function machinePayload() {
    return Object.values(state.machines).map((machine) => ({ status: machine.on ? 'ON' : 'OFF', base_power_kw: machine.base }));
  }

  function renderSensors(sensors) {
    const body = document.getElementById('sensor-list');
    if (!body) return;
    if (!sensors?.length) { body.innerHTML = '<tr><td colspan="5" class="table-state">Nenhum sensor encontrado.</td></tr>'; return; }
    body.replaceChildren(...sensors.map((sensor) => {
      const rawStatus = String(sensor.status || 'OFFLINE').toLowerCase();
      const status = ['online', 'degraded', 'offline'].includes(rawStatus) ? rawStatus : 'offline';
      const label = status === 'online' ? 'ONLINE' : status === 'degraded' ? 'ATENÇÃO' : 'OFFLINE';
      const reading = sensor.last_reading || sensor.reading_timestamp;
      const ago = reading ? `${Math.max(1, Math.round((Date.now() - new Date(reading).getTime()) / 1000))}s atrás` : 'sem leitura';
      const row = document.createElement('tr');
      const identity = document.createElement('td');
      const name = document.createElement('strong');
      name.textContent = sensor.name || 'Sensor';
      const type = document.createElement('small');
      type.textContent = sensor.type || 'SENSOR';
      identity.append(name, type);
      const location = document.createElement('td');
      location.textContent = sensor.location || '—';
      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `sensor-status ${status}`;
      const indicator = document.createElement('i');
      statusBadge.append(indicator, document.createTextNode(label));
      statusCell.append(statusBadge);
      const power = document.createElement('td');
      power.textContent = `${num(sensor.power_kw, 1)} kW`;
      const updated = document.createElement('td');
      updated.textContent = ago;
      row.append(identity, location, statusCell, power, updated);
      return row;
    }));
  }

  async function loadDashboard() {
    if (!AxisApi.token()) return;
    setState('Atualizando...', 'loading');
    try {
      const [dashboard, sensors, machines, forecast] = await Promise.all([AxisApi.dashboard(), AxisApi.sensors(), AxisApi.machines(), AxisApi.forecast()]);
      state.machineApiIds = Object.fromEntries((machines || []).map((machine, index) => [index + 1, machine.id]));
      state.forecast = forecast;
      setText('kpi-kwh', num(dashboard.kpis.kwh_consumed));
      setText('kpi-co2', num(dashboard.kpis.co2_kg));
      setText('kpi-score', Math.round(dashboard.kpis.carbon_score));
      setText('kpi-savings', brl(dashboard.kpis.savings_brl));
      setText('status-sensors', `${dashboard.sensors.online} online`);
      setText('forecast-peak', `${forecast.peak.hour} – ${num(forecast.peak.kwh)} kWh`);
      setText('forecast-best', `${forecast.best.hour} – ${num(forecast.best.kwh)} kWh`);
      setText('forecast-savings', `${brl(forecast.possible_savings_brl)} hoje`);
      if (typeof window.drawForecastChart === 'function') window.drawForecastChart();
      renderSensors(sensors);
      setState(`Dados atualizados às ${new Date().toLocaleTimeString('pt-BR')}`, 'success');
    } catch (error) {
      setState('Não foi possível atualizar os sensores.', 'error');
      showToast(error.message);
    }
  }

  async function loadProfile() {
    if (!AxisApi.token()) return;
    try {
      const profile = await AxisApi.profile();
      const name = document.querySelector('.sidebar-user .user-info strong');
      const role = document.querySelector('.sidebar-user .user-info span');
      const avatar = document.querySelector('.sidebar-user .user-avatar');
      if (name) name.textContent = profile.name || 'Usuário AXIS';
      if (role) role.textContent = profile.organization_role || profile.role || 'VIEWER';
      if (avatar && profile.name) avatar.textContent = profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    } catch (error) { showToast(error.message); }
  }

  async function loadRecommendations() {
    if (!AxisApi.token()) return;
    try {
      const recommendations = await AxisApi.recommendations();
      document.querySelectorAll('.insight-card').forEach((card, index) => {
        const item = recommendations[index];
        if (!item) return;
        card.dataset.recommendationId = item.id;
        const title = card.querySelector('h4');
        const description = card.querySelector('p');
        const impact = card.querySelector('.insight-impact');
        if (title) title.textContent = item.title;
        if (description) description.textContent = `${item.description} Motivos: ${(item.factors || []).join('; ')}.`;
        if (impact) impact.textContent = item.estimated_savings ? `${brl(item.estimated_savings)}/mês` : item.priority;
      });
      setText('ai-points', (recommendations.length * 612 + 11).toLocaleString('pt-BR'));
    } catch (error) { showToast(error.message); }
  }

  async function simulateTwin() {
    clearTimeout(twinTimer);
    twinTimer = setTimeout(async () => {
      try {
        const result = await AxisApi.twin({ production: Number(document.getElementById('sl-prod')?.value || 80), hvac: Number(document.getElementById('sl-hvac')?.value || 60), lighting: Number(document.getElementById('sl-light')?.value || 100), machines: machinePayload() });
        state.twin = { kwh: result.kwh, co2: result.co2_kg, score: result.carbon_score, cost: result.cost_per_hour };
        setText('twin-kwh', `${num(result.kwh)} kWh`);
        setText('twin-co2-sim', `${num(result.co2_kg)} kg`);
        setText('twin-score-sim', Math.round(result.carbon_score));
        setText('twin-cost', brl(result.cost_per_hour));
        const deltas = [['twin-kwh-delta', result.kwh, state.base.kwh, false], ['twin-co2-delta', result.co2_kg, state.base.co2, false], ['twin-score-delta', result.carbon_score, state.base.score, true], ['twin-cost-delta', result.cost_per_hour, state.base.cost, false]];
        deltas.forEach(([id, value, base, higher]) => { const el = document.getElementById(id); if (!el) return; const diff = Number(value) - base; const pct = base ? ((diff / base) * 100).toFixed(1) : '0.0'; el.textContent = diff === 0 ? 'Base atual' : `${diff > 0 ? '+' : ''}${pct}% vs. base`; el.className = `twin-delta ${diff === 0 ? '' : (higher ? diff > 0 : diff < 0) ? 'improve' : 'worse'}`; });
      } catch (error) { showToast(error.message); }
    }, 180);
  }

  window.doLogin = async function doLoginIntegrated() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const btn = document.getElementById('login-btn-text');
    const spin = document.getElementById('login-spinner');
    const error = document.getElementById('login-error');
    btn.classList.add('hidden'); spin.classList.remove('hidden'); error.classList.add('hidden');
    try {
      const result = await AxisApi.login(email, password);
      AxisApi.setToken(result.accessToken, document.getElementById('remember').checked);
      document.getElementById('screen-login').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').style.animation = 'fade-in .4s ease';
      window.initApp();
    } catch (err) {
      error.classList.remove('hidden'); error.lastChild.textContent = ` ${err.message}`;
    } finally { btn.classList.remove('hidden'); spin.classList.add('hidden'); }
  };

  window.initApp = function initIntegratedApp() {
    drawMainChart();
    drawForecastChart();
    drawHistoryChart();
    startLiveClock();
    goTo('dashboard');
    loadProfile();
    loadDashboard();
    loadRecommendations();
    apiPollTimer = setInterval(loadDashboard, 30000);
  };

  window.recalcTwin = () => simulateTwin();
  window.toggleMachine = async function toggleMachineIntegrated(id) {
    updateMachineVisual(id);
    simulateTwin();
    const machineId = state.machineApiIds?.[id];
    if (!machineId) return;
    try {
      await AxisApi.updateMachine(machineId, { status: state.machines[id].on ? 'ON' : 'OFF' });
      showToast(`Máquina ${id} atualizada.`);
    } catch (error) { showToast(error.message); }
  };

  window.runOptimization = async function runOptimizationIntegrated() {
    const button = document.getElementById('btn-optimize');
    const label = document.getElementById('optim-label');
    const resultEl = document.getElementById('optim-result');
    loading(button, true); label.textContent = 'Analisando dados persistidos...';
    try {
      const result = await AxisApi.optimization({ production: 60, hvac: 40, lighting: 70 });
      setText('optim-before-kwh', `${num(result.before_kwh)} kWh`); setText('optim-before-co2', `${num(result.before_co2)} kg`); setText('optim-before-cost', brl(result.before_cost));
      setText('optim-after-kwh', `${num(result.after_kwh)} kWh ↓`); setText('optim-after-co2', `${num(result.after_co2)} kg ↓`); setText('optim-after-cost', `${brl(result.after_cost)} ↓`); setText('optim-savings', `${brl(result.estimated_savings)}`);
      resultEl.style.display = 'block'; resultEl.style.animation = 'fade-slide .4s ease'; label.textContent = 'Otimização concluída'; button.textContent = 'Otimizar novamente'; state.optimized = true; await loadDashboard(); showToast('Otimização registrada no AXIS.');
    } catch (error) { label.textContent = 'Não foi possível concluir'; showToast(error.message); }
    finally { loading(button, false); }
  };

  window.runImpactSimulation = async function runImpactSimulation() {
    const button = document.getElementById('btn-impact');
    const output = document.getElementById('impact-results');
    const selected = document.getElementById('impact-scenario').value;
    const configs = { otimizado: [60, 40, 70], maximo: [35, 25, 45], ponta: [100, 100, 100], 'fora-ponta': [45, 35, 55] };
    const [production, hvac, lighting] = configs[selected]; loading(button, true); output.textContent = 'Calculando projeção...';
    try { const data = await AxisApi.impact(selected, { production, hvac, lighting }); const r = data.result; output.innerHTML = `<div><span>Antes → Depois</span><strong>${num(284.7)} → ${num(r.kwh)} kWh</strong></div><div><span>Energia economizada</span><strong>${num(r.energy_saved_kwh)} kWh</strong></div><div><span>CO₂ evitado</span><strong>${num(r.co2_avoided_kg)} kg</strong></div><div><span>Projeção mensal</span><strong>${brl(r.monthly_savings_brl)}</strong></div><div><span>Projeção anual</span><strong>${brl(r.annual_savings_brl)}</strong></div>`; } catch (error) { output.textContent = error.message; } finally { loading(button, false); }
  };

  window.applyInsight = async function applyInsightIntegrated(event, message) {
    applyInsightVisual(event, message);
    const card = event.target.closest('.insight-card');
    if (card?.dataset.recommendationId) { try { await AxisApi.updateRecommendation(card.dataset.recommendationId, 'APPLIED'); } catch (error) { showToast(error.message); } }
  };

  window.logout = async function logoutIntegrated() {
    try { if (AxisApi.token()) await AxisApi.logout(); } catch { /* a sessão pode já ter expirado */ }
    AxisApi.clearToken();
    clearInterval(apiPollTimer);
    document.getElementById('app')?.classList.add('hidden');
    const login = document.getElementById('screen-login');
    if (login) { login.style.display = ''; login.style.animation = ''; }
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').classList.add('hidden');
    showToast('Sessão encerrada com segurança');
  };

  window.addEventListener('axis:session-expired', () => {
    clearInterval(apiPollTimer);
    document.getElementById('app')?.classList.add('hidden');
    const login = document.getElementById('screen-login');
    if (login) login.style.display = '';
    showToast('Sua sessão expirou. Entre novamente para continuar.');
  });

  window.addEventListener('DOMContentLoaded', () => {
    if (AxisApi.token()) { document.getElementById('screen-login').style.display = 'none'; document.getElementById('app').classList.remove('hidden'); window.initApp(); }
  });
})();
