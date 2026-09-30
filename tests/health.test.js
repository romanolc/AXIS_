import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, startServer } from '../backend/server.js';

const execFileAsync = promisify(execFile);
const server = startServer(0);
let baseUrl;
let accessToken;

before(async () => {
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function request(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json();
  return { response, body };
}

function authHeaders(token = accessToken) {
  return { authorization: `Bearer ${token}` };
}

test('GET /api/health é público e identifica o modo demo', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.demoMode, true);
});

test('DEMO_MODE controla explicitamente o backend de dados', async () => {
  const source = "import('./backend/database/client.js').then(({ db }) => console.log(JSON.stringify({ enabled: db.enabled })))";
  const run = (extraEnv) => execFileAsync(process.execPath, ['--input-type=module', '-e', source], { cwd: new URL('..', import.meta.url), env: { ...process.env, ...extraEnv } });
  const demo = await run({ DEMO_MODE: 'true', DATABASE_URL: 'postgresql://invalid-host/axis' });
  assert.deepEqual(JSON.parse(demo.stdout.trim()), { enabled: false });
  const postgres = await run({ DEMO_MODE: 'false', DATABASE_URL: 'postgresql://invalid-host/axis' });
  assert.deepEqual(JSON.parse(postgres.stdout.trim()), { enabled: true });
  await assert.rejects(run({ DEMO_MODE: 'false', DATABASE_URL: '' }), /DATABASE_URL is required when DEMO_MODE=false/);
});

test('rotas protegidas rejeitam ausência e token JWT inválido', async () => {
  const anonymous = await request('/api/dashboard');
  assert.equal(anonymous.response.status, 401);
  const invalid = await request('/api/dashboard', { headers: authHeaders('not-a-real-token') });
  assert.equal(invalid.response.status, 401);
});

test('login Argon2id válido e inválido', async () => {
  const invalid = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@axis.energy', password: 'senha-incorreta' }) });
  assert.equal(invalid.response.status, 401);
  const valid = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@axis.energy', password: 'axis2025' }) });
  assert.equal(valid.response.status, 200);
  assert.match(valid.body.data.accessToken, /^ey/);
  accessToken = valid.body.data.accessToken;
  assert.equal(valid.body.data.demo, true);
});

test('login aplica rate limiting moderado sem revelar existência de e-mail', async () => {
  const email = 'brute-force-test@invalid.example';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const failed = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'senha-incorreta' }) });
    assert.equal(failed.response.status, 401);
    assert.match(failed.body.error.message, /E-mail ou senha incorretos/);
  }
  const limited = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'senha-incorreta' }) });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.body.error.code, 'LOGIN_RATE_LIMITED');
  assert.equal(limited.response.headers.get('retry-after'), '60');
});

test('render de sensores não interpola valores externos diretamente em HTML', async () => {
  const source = await readFile(new URL('../frontend/js/integration.js', import.meta.url), 'utf8');
  assert.match(source, /document\.createElement\('tr'\)/);
  assert.match(source, /name\.textContent = sensor\.name/);
  assert.match(source, /location\.textContent = sensor\.location/);
  assert.doesNotMatch(source, /<tr>.*\$\{sensor\.(name|location|type)/s);
  assert.doesNotMatch(source, /<span class="sensor-status \$\{status\}"/);
});

test('dashboard, sensores, recomendações e perfil exigem sessão válida', async () => {
  const dashboard = await request('/api/dashboard', { headers: authHeaders() });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.data.simulated, true);
  assert.ok(dashboard.body.data.kpis);

  const sensors = await request('/api/sensors', { headers: authHeaders() });
  assert.equal(sensors.response.status, 200);
  assert.ok(sensors.body.data.length >= 1);

  const recommendations = await request('/api/recommendations', { headers: authHeaders() });
  assert.equal(recommendations.response.status, 200);
  assert.ok(recommendations.body.data.length >= 1);

  const profile = await request('/api/user/profile', { headers: authHeaders() });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.email, 'admin@axis.energy');
});

test('Digital Twin, otimização e Impact Simulator executam no backend', async () => {
  const twin = await request('/api/twin/simulate', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ production: 60, hvac: 40, lighting: 70, machines: [{ status: 'OFF', base_power_kw: 85 }] }) });
  assert.equal(twin.response.status, 200);
  assert.equal(twin.body.data.simulated, true);
  assert.equal(twin.body.data.factors.active_power_kw, 0);

  const optimization = await request('/api/optimization/run', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ scenario: { production: 60, hvac: 40, lighting: 70 } }) });
  assert.equal(optimization.response.status, 201);
  assert.ok(optimization.body.data.id);

  const impact = await request('/api/scenarios/simulate', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: 'teste-auditoria', configuration: { production: 60, hvac: 40, lighting: 70 } }) });
  assert.equal(impact.response.status, 201);
  assert.equal(impact.body.data.result.simulated, true);
  assert.ok(impact.body.data.result.monthly_savings_brl >= 0);
});

test('atualização de máquina e recomendação respeitam a sessão', async () => {
  const machines = await request('/api/machines', { headers: authHeaders() });
  assert.equal(machines.response.status, 200);
  const machine = machines.body.data[0];
  const updatedMachine = await request(`/api/machines/${machine.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'OFF' }) });
  assert.equal(updatedMachine.response.status, 200);
  assert.equal(updatedMachine.body.data.status, 'OFF');

  const recommendations = await request('/api/recommendations', { headers: authHeaders() });
  const updatedRecommendation = await request(`/api/recommendations/${recommendations.body.data[0].id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'APPLIED' }) });
  assert.equal(updatedRecommendation.response.status, 200);
  assert.equal(updatedRecommendation.body.data.status, 'APPLIED');
});

test('recuperação de senha permanece explicitamente como contrato preparado e logout funciona', async () => {
  const recovery = await request('/api/auth/password-recovery', { method: 'POST', body: JSON.stringify({ email: 'admin@axis.energy' }) });
  assert.equal(recovery.response.status, 200);
  assert.equal(recovery.body.data.accepted, true);

  const logout = await request('/api/auth/logout', { method: 'POST', headers: authHeaders() });
  assert.equal(logout.response.status, 200);
});
