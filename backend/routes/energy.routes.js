import { Router } from 'express';
import { z } from 'zod';
import { getDashboard, getReadings, getSensors, getMachines, updateMachine } from '../services/energy.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendData } from '../utils/helpers.js';

const router = Router();
const machinePatch = z.object({ status: z.enum(['ON', 'OFF', 'MAINTENANCE']).optional(), current_power_kw: z.number().nonnegative().optional() }).refine((data) => Object.keys(data).length > 0);
router.use(requireAuth);
router.get('/dashboard', async (req, res) => sendData(res, await getDashboard(req.user.organizationId)));
router.get('/energy/readings', async (req, res) => sendData(res, await getReadings(req.user.organizationId, Math.min(Number(req.query.limit || 100), 500))));
  router.get('/energy/forecast', async (_req, res) => sendData(res, { horizon_hours: 12, values: [89, 95, 108, 130, 165, 210, 248, 280, 312, 295, 270, 240], peak: { hour: '18:00', kwh: 312 }, best: { hour: '03:00', kwh: 89 }, possible_savings_brl: 847, simulated: true }));
router.get('/sensors', async (req, res) => sendData(res, await getSensors(req.user.organizationId)));
router.get('/machines', async (req, res) => sendData(res, await getMachines(req.user.organizationId)));
router.patch('/machines/:id', validate(machinePatch), async (req, res) => {
  const machine = await updateMachine(req.params.id, req.user.organizationId, req.body);
  if (!machine) return res.status(404).json({ error: { code: 'MACHINE_NOT_FOUND', message: 'Máquina não encontrada.' } });
  return sendData(res, machine);
});
export default router;
