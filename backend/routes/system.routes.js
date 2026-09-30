import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard } from '../services/energy.service.js';
import { sendData } from '../utils/helpers.js';
import { db } from '../database/client.js';
import { env } from '../config/env.js';

const router = Router();
router.get('/health', async (_req, res) => sendData(res, { status: 'ok', service: 'axis-api', database: db.enabled ? 'configured' : 'demo-memory', demoMode: env.demoMode, simulated: env.demoMode, timestamp: new Date().toISOString() }));
router.get('/sustainability', requireAuth, async (req, res) => {
  const dashboard = await getDashboard(req.user.organizationId);
  return sendData(res, { carbon_score: dashboard.kpis.carbon_score, energy_saved_kwh: 1240, co2_avoided_kg: 620, savings_brl: 4280, efficiency: 91, ods: [{ id: 7, title: 'Energia limpa e acessível' }, { id: 9, title: 'Indústria, inovação e infraestrutura' }, { id: 13, title: 'Ação contra a mudança global do clima' }], simulated: dashboard.simulated });
});
export default router;
