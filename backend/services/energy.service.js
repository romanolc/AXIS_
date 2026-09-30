import { db } from '../database/client.js';
import { demoStore, getDemoOrganizationId } from '../database/demo-store.js';

export async function getSensors(organizationId = getDemoOrganizationId()) {
  if (!db.enabled) return demoStore.sensors;
  return (await db.query('SELECT s.*, latest.power_kw, latest.energy_kwh, latest.timestamp AS reading_timestamp FROM sensors s LEFT JOIN LATERAL (SELECT power_kw, energy_kwh, timestamp FROM energy_readings er WHERE er.sensor_id = s.id ORDER BY timestamp DESC LIMIT 1) latest ON TRUE WHERE s.organization_id = $1 ORDER BY s.name', [organizationId])).rows;
}

export async function getMachines(organizationId = getDemoOrganizationId()) {
  if (!db.enabled) return demoStore.machines;
  return (await db.query('SELECT * FROM machines WHERE organization_id = $1 ORDER BY name', [organizationId])).rows;
}

export async function updateMachine(id, organizationId = getDemoOrganizationId(), patch = {}) {
  if (!db.enabled) {
    const machine = demoStore.machines.find((item) => item.id === id && (!item.organization_id || item.organization_id === organizationId));
    if (!machine) return null;
    Object.assign(machine, patch);
    if (patch.status) machine.current_power_kw = patch.status === 'ON' ? machine.base_power_kw : 0;
    return machine;
  }
  const result = await db.query('UPDATE machines SET status = COALESCE($1,status), current_power_kw = COALESCE($2,current_power_kw) WHERE id = $3 AND organization_id = $4 RETURNING *', [patch.status, patch.current_power_kw, id, organizationId]);
  return result.rows[0] || null;
}

export async function getReadings(organizationId = getDemoOrganizationId(), limit = 100) {
  if (!db.enabled) return demoStore.readings.slice(-limit);
  return (await db.query('SELECT er.* FROM energy_readings er JOIN sensors s ON s.id = er.sensor_id WHERE s.organization_id = $1 ORDER BY timestamp DESC LIMIT $2', [organizationId, limit])).rows;
}

export async function getDashboard(organizationId = getDemoOrganizationId()) {
  const [sensors, machines, readings] = await Promise.all([getSensors(organizationId), getMachines(organizationId), getReadings(organizationId, 24)]);
  const kwh = readings.length ? Number(readings.at(-1).energy_kwh) : 284.7;
  const co2 = Number((kwh * 0.5).toFixed(1));
  const power = machines.reduce((sum, machine) => sum + Number(machine.current_power_kw || 0), 0);
  return { kpis: { kwh_consumed: kwh, co2_kg: co2, carbon_score: 87, savings_brl: 4280, power_kw: Number(power.toFixed(1)) }, sensors: { total: sensors.length, online: sensors.filter((s) => s.status === 'ONLINE').length, offline: sensors.filter((s) => s.status === 'OFFLINE').length }, readings, simulated: !db.enabled };
}
