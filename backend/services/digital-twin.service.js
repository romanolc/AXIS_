import { clamp, round } from '../utils/helpers.js';

export function calculateTwin({ production = 80, hvac = 60, lighting = 100, machines = [] }) {
  const prod = clamp(Number(production), 0, 100) / 100;
  const air = clamp(Number(hvac), 0, 100) / 100;
  const light = clamp(Number(lighting), 0, 100) / 100;
  const activePower = machines.reduce((sum, machine) => sum + (machine.status === 'ON' ? Number(machine.base_power_kw) : 0), 0);
  const machineFactor = activePower > 0 ? activePower / 240 : 0.15;
  const factor = prod * 0.5 + air * 0.3 + light * 0.2;
  const kwh = round(284.7 * (factor * machineFactor) + 42.7, 1);
  const co2 = round(kwh * 0.5, 1);
  const cost = round(kwh * 0.325, 2);
  const efficiency = round(clamp(100 - ((kwh - 180) / 2.4), 20, 99), 0);
  const score = round(clamp(87 + ((284.7 - kwh) * 0.2), 20, 99), 0);
  return { kwh, power_kw: round(activePower * factor, 1), co2_kg: co2, cost_per_hour: cost, efficiency, carbon_score: score, simulated: true, factors: { production: prod, hvac: air, lighting: light, active_power_kw: activePower } };
}
