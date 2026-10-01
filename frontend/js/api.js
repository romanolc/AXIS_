(() => {
  const TOKEN_KEY = 'axis.accessToken';

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('axis:session-expired'));
      throw new Error(body?.error?.message || 'Sessão expirada.');
    }
    if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
    return body.data;
  }

  const json = (method, path, payload) => request(path, { method, body: JSON.stringify(payload) });
  async function download(path) {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const response = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('axis:session-expired'));
      throw new Error('Sessão expirada.');
    }
    if (!response.ok) throw new Error('Não foi possível gerar o relatório.');
    return response.blob();
  }
  window.AxisApi = {
    token: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
    setToken: (token, remember = true) => (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token),
    clearToken: () => { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); },
    login: (email, password) => json('POST', '/api/auth/login', { email, password }),
    logout: () => json('POST', '/api/auth/logout', {}),
    passwordRecovery: (email) => json('POST', '/api/auth/password-recovery', { email }),
    profile: () => request('/api/user/profile'),
    dashboard: () => request('/api/dashboard'),
    sensors: () => request('/api/sensors'),
    machines: () => request('/api/machines'),
    updateMachine: (id, patch) => json('PATCH', `/api/machines/${id}`, patch),
    recommendations: () => request('/api/recommendations'),
    forecast: () => request('/api/energy/forecast'),
    sustainability: () => request('/api/sustainability'),
    sustainabilityReferences: () => request('/api/sustainability/reference-data'),
    efficiencySimulation: (payload) => json('POST', '/api/sustainability/efficiency-simulation', payload),
    sustainabilityPdf: (kind) => download(`/api/sustainability/reports/${kind}.pdf`),
    twin: (configuration) => json('POST', '/api/twin/simulate', configuration),
    optimization: (scenario) => json('POST', '/api/optimization/run', { scenario }),
    impact: (name, configuration) => json('POST', '/api/scenarios/simulate', { name, configuration }),
    updateRecommendation: (id, status) => json('PATCH', `/api/recommendations/${id}`, { status })
  };
})();
