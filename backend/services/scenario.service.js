import { demoStore, getDemoOrganizationId, createId } from '../database/demo-store.js';
import { db } from '../database/client.js';
import { calculateTwin } from './digital-twin.service.js';
import { getMachines } from './energy.service.js';
import { calculateCo2e } from './sustainability.service.js';

export async function simulateScenario({ organizationId = getDemoOrganizationId(), name = 'Simulação', configuration }) {
  const machines = await getMachines(organizationId);
  const current = calculateTwin({ production: 80, hvac: 60, lighting: 100, machines });
  const result = calculateTwin({ ...configuration, machines });
  const environmental = calculateCo2e({ referenceKwh: current.kwh, optimizedKwh: result.kwh });
  const hourlySavings = Number(Math.max(0, current.cost_per_hour - result.cost_per_hour).toFixed(2));
  const impact = { ...result, energy_saved_kwh: environmental.energy_saved_kwh, energy_saved_mwh: environmental.energy_saved_mwh, co2_avoided_kg: environmental.co2e_avoided_tonnes === null ? null : Number((environmental.co2e_avoided_tonnes * 1000).toFixed(3)), co2e_avoided_tonnes: environmental.co2e_avoided_tonnes, emission_factor: environmental.factor, co2e_status: environmental.status, hourly_savings_brl: hourlySavings, monthly_savings_brl: Number((hourlySavings * 24 * 30).toFixed(2)), annual_savings_brl: Number((hourlySavings * 24 * 365).toFixed(2)), simulated: true };
  const scenario = { id: createId(), organization_id: organizationId, name, configuration, result: impact, created_at: new Date().toISOString() };
  if (!db.enabled) demoStore.scenarios.unshift(scenario);
  else {
    const saved = await db.query('INSERT INTO scenarios (organization_id, name, configuration, result) VALUES ($1,$2,$3,$4) RETURNING *', [organizationId, name, configuration, impact]);
    return saved.rows[0];
  }
  return scenario;
}

export async function listScenarios(organizationId = getDemoOrganizationId()) {
  if (!db.enabled) return demoStore.scenarios.filter((item) => item.organization_id === organizationId);
  return (await db.query('SELECT * FROM scenarios WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId])).rows;
}
