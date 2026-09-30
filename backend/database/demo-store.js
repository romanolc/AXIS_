import crypto from 'node:crypto';

const id = () => crypto.randomUUID();
const organizationId = '00000000-0000-0000-0000-000000000001';
const demoUserId = '00000000-0000-0000-0000-000000000002';
const sensorIds = [1, 2, 3].map((n) => `00000000-0000-0000-0000-00000000010${n}`);
const machineIds = [1, 2, 3, 4, 5].map((n) => `00000000-0000-0000-0000-00000000020${n}`);

const sensors = [
  { id: sensorIds[0], name: 'SENSOR-001', type: 'POWER_METER', location: 'Production Line 1', status: 'ONLINE', power_kw: 85.2, energy_kwh: 284.7, last_reading: new Date(Date.now() - 3000).toISOString() },
  { id: sensorIds[1], name: 'SENSOR-002', type: 'HVAC', location: 'HVAC', status: 'ONLINE', power_kw: 42.7, energy_kwh: 131.6, last_reading: new Date(Date.now() - 2000).toISOString() },
  { id: sensorIds[2], name: 'SENSOR-003', type: 'POWER_METER', location: 'Warehouse', status: 'DEGRADED', power_kw: 18.4, energy_kwh: 58.3, last_reading: new Date(Date.now() - 95000).toISOString() }
];

const machines = [
  { id: machineIds[0], name: 'Máquina A1', sector: 'PRODUÇÃO', status: 'ON', base_power_kw: 85, current_power_kw: 85 },
  { id: machineIds[1], name: 'Máquina A2', sector: 'PRODUÇÃO', status: 'ON', base_power_kw: 72, current_power_kw: 72 },
  { id: machineIds[2], name: 'Máquina A3', sector: 'PRODUÇÃO', status: 'OFF', base_power_kw: 68, current_power_kw: 0 },
  { id: machineIds[3], name: 'Compressor B1', sector: 'COMPRESSORES', status: 'ON', base_power_kw: 45, current_power_kw: 45 },
  { id: machineIds[4], name: 'Compressor B2', sector: 'COMPRESSORES', status: 'ON', base_power_kw: 38, current_power_kw: 38 }
];

export const demoStore = {
  organization: { id: organizationId, name: 'AXIS Demo Industries', created_at: '2026-01-10T12:00:00.000Z' },
  user: { id: demoUserId, name: 'Ana Gonçalves', email: 'admin@axis.energy', avatar_url: null, role: 'ADMIN', organization_id: organizationId, created_at: '2026-01-10T12:00:00.000Z' },
  sensors,
  machines,
  readings: [],
  recommendations: [
    { id: id(), title: 'Reduzir carga da Linha 3', description: 'A carga da Linha 3 está acima da média histórica e há previsão de pico nas próximas 2 horas.', priority: 'HIGH', estimated_savings: 1240, status: 'OPEN', factors: ['consumo 18% acima da média histórica', 'previsão de pico nas próximas 2 horas', 'tarifa atual superior ao período fora de ponta'] , created_at: new Date().toISOString() },
    { id: id(), title: 'Programar compressores no horário fora de ponta', description: 'Transferir carga flexível para a janela de menor tarifa.', priority: 'MEDIUM', estimated_savings: 847, status: 'OPEN', factors: ['tarifa fora de ponta 40% menor', 'carga transferível identificada'], created_at: new Date().toISOString() }
  ],
  optimizationRuns: [],
  scenarios: [],
  preferences: {}
};

for (const collection of [demoStore.sensors, demoStore.machines, demoStore.recommendations]) {
  collection.forEach((item) => { item.organization_id = organizationId; });
}

for (let i = 0; i < 24; i += 1) {
  const timestamp = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString();
  demoStore.readings.push({ sensor_id: sensorIds[0], timestamp, energy_kwh: 190 + (i * 4.1), power_kw: 150 + ((i % 6) * 12), voltage: 380, current: 225 + i, carbon_factor: 0.5 });
}

export function getDemoUser() { return demoStore.user; }
export function getDemoOrganizationId() { return organizationId; }
export function createId() { return id(); }
