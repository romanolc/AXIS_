import { demoStore, getDemoOrganizationId, createId } from '../database/demo-store.js';
import { db } from '../database/client.js';
import { calculateTwin } from './digital-twin.service.js';
import { round } from '../utils/helpers.js';
import { calculateCo2e } from './sustainability.service.js';

export async function runOptimization({ organizationId = getDemoOrganizationId(), scenario = {} }) {
  const machines = db.enabled ? (await db.query('SELECT * FROM machines WHERE organization_id = $1', [organizationId])).rows : demoStore.machines;
  const before = calculateTwin({ production: 80, hvac: 60, lighting: 100, machines });
  const after = calculateTwin({ production: scenario.production ?? 60, hvac: scenario.hvac ?? 40, lighting: scenario.lighting ?? 70, machines: machines.map((machine) => machine.name.includes('A3') ? { ...machine, status: 'OFF' } : machine) });
  const environmental = calculateCo2e({ referenceKwh: before.kwh, optimizedKwh: after.kwh });
  const run = { id: createId(), organization_id: organizationId, created_at: new Date().toISOString(), before_kwh: before.kwh, after_kwh: after.kwh, before_co2: before.co2_kg, after_co2: after.co2_kg, before_cost: before.cost_per_hour, after_cost: after.cost_per_hour, energy_saved_kwh: environmental.energy_saved_kwh, energy_saved_mwh: environmental.energy_saved_mwh, co2e_avoided_tonnes: environmental.co2e_avoided_tonnes, emission_factor: environmental.factor, co2e_status: environmental.status, estimated_savings: round(Math.max(0, before.cost_per_hour - after.cost_per_hour) * 24 * 30, 2), scenario: { production: scenario.production ?? 60, hvac: scenario.hvac ?? 40, lighting: scenario.lighting ?? 70 } };
  if (!db.enabled) demoStore.optimizationRuns.unshift(run);
  else {
    const result = await db.query(`INSERT INTO optimization_runs (organization_id, before_kwh, after_kwh, before_co2, after_co2, before_cost, after_cost, estimated_savings, scenario, energy_saved_kwh, energy_saved_mwh, co2e_avoided_tonnes, emission_factor, co2e_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [organizationId, run.before_kwh, run.after_kwh, run.before_co2, run.after_co2, run.before_cost, run.after_cost, run.estimated_savings, run.scenario, run.energy_saved_kwh, run.energy_saved_mwh, run.co2e_avoided_tonnes, run.emission_factor, run.co2e_status]);
    return result.rows[0];
  }
  return run;
}

export async function listOptimizationRuns(organizationId = getDemoOrganizationId()) {
  if (!db.enabled) return demoStore.optimizationRuns.filter((run) => run.organization_id === organizationId);
  return (await db.query('SELECT * FROM optimization_runs WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId])).rows;
}
