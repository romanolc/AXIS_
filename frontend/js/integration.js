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

  function renderSustainability(report) {
    const impact = report.impact || {};
    const configured = Boolean(impact.configured);
    setText('sustain-data-status', report.data_status || 'ESTIMADO');
    setText('sustain-co2e-value', configured ? `${num(impact.co2e_avoided_tonnes, 3)}` : '—');
    setText('sustain-co2e-unit', configured ? 'tCO2e estimado evitado' : 'Fator de emissão não configurado');
    setText('sustain-co2e-trend', configured ? `Base: ${num(impact.energy_saved_mwh, 3)} MWh economizados. Resultado estimado.` : 'Configure um fator oficial com fonte e período para calcular o CO2e.');
    setText('calc-reference', `${num(impact.reference_kwh, 1)} kWh`);
    setText('calc-optimized', `${num(impact.optimized_kwh, 1)} kWh`);
    setText('calc-saved', `${num(impact.energy_saved_mwh, 3)} MWh`);
    setText('calc-factor', impact.factor?.value === null || impact.factor?.value === undefined ? 'Não configurado' : `${num(impact.factor.value, 4)} ${impact.factor.unit}`);
    setText('calc-co2e', configured ? `${num(impact.co2e_avoided_tonnes, 3)} tCO2e` : 'Não calculado');
    setText('calc-note', configured ? `Fonte: ${impact.factor.source}. Período: ${impact.factor.period || 'não informado'}. Data: ${impact.factor.reference_date || 'não informada'}.` : 'O cálculo só apresenta CO2e quando o fator oficial está configurado com fonte, período, unidade e data de referência.');
    const intensity = report.intensity || {};
    setText('dashboard-energy-intensity', intensity.available ? `${num(intensity.value, 3)} ${intensity.unit}` : '—');
    setText('dashboard-energy-intensity-note', intensity.available ? intensity.formula : 'Energia consumida / unidade produzida');
    setText('dashboard-intensity-state', intensity.available ? 'Estimativa operacional' : 'Aguardando dados de produção');
    setText('dashboard-assets-monitored', report.ods?.ods9?.value_percent === undefined ? '—' : `${num(report.ods.ods9.value_percent, 1)}%`);
    setText('national-consumption', `${num((report.national_scale_simulation?.consumption_gwh || 0) / 1000, 1)} TWh`);
    setText('national-simulation', report.national_scale_simulation?.statement || 'Simulação nacional não disponível.');
    document.querySelectorAll('.esg-goal').forEach((goal, index) => {
      const item = report.goals?.[index];
      if (!item) return;
      const pct = goal.querySelector('.esg-pct');
      const bar = goal.querySelector('.esg-bar');
      const target = goal.querySelector('.esg-target');
      if (pct) pct.textContent = `${item.progress}%`;
      if (bar) bar.style.width = `${item.progress}%`;
      if (target) target.textContent = `${item.target} · ${item.status}`;
    });
  }

  async function loadSustainability() {
    if (!AxisApi.token()) return;
    try { renderSustainability(await AxisApi.sustainability()); }
    catch (error) { showToast(error.message); }
  }

  window.toggleImpactCalculation = function toggleImpactCalculation() {
    document.getElementById('impact-calculation')?.classList.toggle('hidden');
  };

  window.downloadSustainabilityPdf = async function downloadSustainabilityPdf(kind) {
    try {
      const blob = await AxisApi.sustainabilityPdf(kind);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = kind === 'institutional' ? 'axis-relatorio-institucional.pdf' : 'axis-metas-esg-2025.pdf';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      showToast('PDF gerado com os dados disponíveis no AXIS.');
    } catch (error) { showToast(error.message); }
  };

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
        const twinImpact = result.environmental_impact || {};
        setText('twin-co2e-avoided', twinImpact.co2e_avoided_tonnes === null || twinImpact.co2e_avoided_tonnes === undefined ? '—' : `${num(twinImpact.co2e_avoided_tonnes, 3)} t`);
        setText('twin-co2e-delta', twinImpact.configured ? 'Estimativa operacional' : 'Fator não configurado');
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
    loadSustainability();
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
    const efficiency = { conservador: 5, referencia: 15, potencial: 30 };
    loading(button, true); output.textContent = 'Calculando projeção...';
    try {
      if (efficiency[selected]) {
        const r = await AxisApi.efficiencySimulation({ annual_consumption_mwh: 1000, reduction_percent: efficiency[selected], tariff_brl_mwh: 0 });
        const co2e = r.co2e_avoided_tonnes === null ? 'Não calculado' : `${num(r.co2e_avoided_tonnes, 3)} tCO2e`;
        output.innerHTML = `<div><span>Consumo atual → cenário</span><strong>${num(r.annual_consumption_mwh)} → ${num(r.optimized_consumption_mwh)} MWh/ano</strong></div><div><span>Redução hipotética</span><strong>${num(r.reduction_percent)}%</strong></div><div><span>Energia potencialmente economizada</span><strong>${num(r.energy_saved_mwh)} MWh/ano</strong></div><div><span>Economia financeira estimada</span><strong>${brl(r.estimated_savings_brl)}</strong></div><div><span>CO2e evitado</span><strong>${co2e}</strong></div><small class="simulation-note">${r.note}</small>`;
      } else {
        const [production, hvac, lighting] = configs[selected];
        const data = await AxisApi.impact(selected, { production, hvac, lighting }); const r = data.result; const co2e = r.co2e_avoided_tonnes === null ? 'Não calculado' : `${num(r.co2e_avoided_tonnes, 3)} tCO2e`; output.innerHTML = `<div><span>Atual → Otimizado</span><strong>${num(r.reference_kwh)} → ${num(r.optimized_kwh)} kWh</strong></div><div><span>Energia economizada</span><strong>${num(r.energy_saved_mwh, 3)} MWh</strong></div><div><span>Economia mensal</span><strong>${brl(r.monthly_savings_brl)}</strong></div><div><span>CO2e estimado evitado</span><strong>${co2e}</strong></div><div><span>Fator de emissão</span><strong>${r.emission_factor?.value === null ? 'Não configurado' : `${num(r.emission_factor.value, 4)} ${r.emission_factor.unit}`}</strong></div>`;
      }
    } catch (error) { output.textContent = error.message; } finally { loading(button, false); }
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

  function syncVlibrasButton() {
    const widgetButton = window.VLibrasWidget?.initBtn;
    const status = document.getElementById('vlibras-status');
    if (!widgetButton) return false;
    widgetButton.style.display = 'none';
    widgetButton.setAttribute('aria-hidden', 'true');
    if (status) status.textContent = 'Intérprete oficial pronto para abrir.';
    return true;
  }

  window.openVlibras = function openVlibras() {
    if (syncVlibrasButton()) {
      window.VLibrasWidget.initBtn.click();
      return;
    }
    const status = document.getElementById('vlibras-status');
    if (status) status.textContent = 'O intérprete não está disponível no momento.';
    showToast('Não foi possível carregar o intérprete VLibras.');
  };

  window.addEventListener('load', () => {
    if (!syncVlibrasButton()) {
      const status = document.getElementById('vlibras-status');
      if (status) status.textContent = 'Disponível quando o serviço externo estiver carregado.';
    }
  });

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
