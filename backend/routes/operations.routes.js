import { Router } from 'express';
import { z } from 'zod';
import { calculateTwin } from '../services/digital-twin.service.js';
import { runOptimization, listOptimizationRuns } from '../services/optimization.service.js';
import { simulateScenario, listScenarios } from '../services/scenario.service.js';
import { getMachines } from '../services/energy.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendData } from '../utils/helpers.js';
import { calculateCo2e } from '../services/sustainability.service.js';

const router = Router();
const configuration = z.object({
  production: z.number().min(0).max(100),
  hvac: z.number().min(0).max(100),
  lighting: z.number().min(0).max(100),
  machines: z.array(z.object({ status: z.enum(['ON', 'OFF', 'MAINTENANCE']), base_power_kw: z.number().nonnegative() })).optional()
});
const scenarioSchema = z.object({ name: z.string().min(1).max(100), configuration });
router.use(requireAuth);
router.post('/twin/simulate', validate(configuration), async (req, res) => {
  const machines = req.body.machines || await getMachines(req.user.organizationId);
  const result = calculateTwin({ ...req.body, machines });
  const baseline = calculateTwin({ production: 80, hvac: 60, lighting: 100, machines });
  return sendData(res, { ...result, environmental_impact: calculateCo2e({ referenceKwh: baseline.kwh, optimizedKwh: result.kwh }) });
});
router.get('/optimization', async (req, res) => sendData(res, await listOptimizationRuns(req.user.organizationId)));
router.post('/optimization/run', validate(z.object({ scenario: configuration.partial().default({}) })), async (req, res) => sendData(res, await runOptimization({ organizationId: req.user.organizationId, scenario: req.body.scenario }), 201));
router.get('/scenarios', async (req, res) => sendData(res, await listScenarios(req.user.organizationId)));
router.post('/scenarios', validate(scenarioSchema), async (req, res) => sendData(res, await simulateScenario({ organizationId: req.user.organizationId, ...req.body }), 201));
router.post('/scenarios/simulate', validate(scenarioSchema), async (req, res) => sendData(res, await simulateScenario({ organizationId: req.user.organizationId, ...req.body }), 201));
export default router;
