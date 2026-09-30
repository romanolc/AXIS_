import { demoStore, getDemoOrganizationId, createId } from '../database/demo-store.js';
import { db } from '../database/client.js';

export async function listRecommendations(organizationId = getDemoOrganizationId()) {
  if (!db.enabled) return demoStore.recommendations.filter((item) => !organizationId || item.organization_id === organizationId || !item.organization_id);
  const result = await db.query('SELECT * FROM recommendations WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId]);
  return result.rows;
}

export async function applyRecommendation(id, organizationId = getDemoOrganizationId(), status) {
  if (!db.enabled) {
    const item = demoStore.recommendations.find((row) => row.id === id && (!row.organization_id || row.organization_id === organizationId));
    if (!item) return null;
    item.status = status;
    return item;
  }
  const result = await db.query('UPDATE recommendations SET status = $1 WHERE id = $2 AND organization_id = $3 RETURNING *', [status, id, organizationId]);
  return result.rows[0] || null;
}

export function generateRecommendations({ consumption = 284.7, historicalAverage = 240, peakForecast = 312, peakLimit = 300 }) {
  const generated = [];
  if (consumption > historicalAverage * 1.1) generated.push({ id: createId(), title: 'Investigar consumo acima da média', description: 'O consumo atual supera a média histórica em mais de 10%.', priority: 'HIGH', estimated_savings: 0, status: 'OPEN', factors: [`consumo ${Math.round((consumption / historicalAverage - 1) * 100)}% acima da média histórica`] });
  if (peakForecast > peakLimit) generated.push({ id: createId(), title: 'Reduzir carga antes do pico previsto', description: 'A previsão ultrapassa o limite operacional configurado.', priority: 'CRITICAL', estimated_savings: 1240, status: 'OPEN', factors: [`previsão de pico de ${peakForecast} kWh`, `limite configurado de ${peakLimit} kWh`] });
  return generated;
}
