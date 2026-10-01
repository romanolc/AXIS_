import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { sendData } from '../utils/helpers.js';
import { db } from '../database/client.js';
import { env } from '../config/env.js';
import { createSustainabilityPdf, getSustainabilityReport, EXTERNAL_REFERENCES, EFFICIENCY_SCENARIOS, simulateEfficiency } from '../services/sustainability.service.js';

const router = Router();
router.get('/health', async (_req, res) => sendData(res, { status: 'ok', service: 'axis-api', database: db.enabled ? 'configured' : 'demo-memory', demoMode: env.demoMode, simulated: env.demoMode, timestamp: new Date().toISOString() }));
router.get('/sustainability', requireAuth, async (req, res) => {
  const report = await getSustainabilityReport(req.user.organizationId);
  return sendData(res, { ...report, ods: { ...report.ods, references: [{ id: 7, title: 'Energia limpa e acessível' }, { id: 9, title: 'Indústria, inovação e infraestrutura' }, { id: 13, title: 'Ação contra a mudança climática' }] } });
});
router.get('/sustainability/reference-data', requireAuth, async (_req, res) => sendData(res, { type: 'DADO REAL', references: EXTERNAL_REFERENCES, scenarios: EFFICIENCY_SCENARIOS }));
router.post('/sustainability/efficiency-simulation', requireAuth, async (req, res) => {
  const schema = z.object({ annual_consumption_mwh: z.number().positive().max(100000000), reduction_percent: z.number().min(0).max(100), tariff_brl_mwh: z.number().nonnegative().max(1000000).default(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Consumo, redução e tarifa devem ser numéricos e válidos.', details: parsed.error.flatten() } });
  return sendData(res, simulateEfficiency({ annualConsumptionMwh: parsed.data.annual_consumption_mwh, reductionPercent: parsed.data.reduction_percent, tariffBrlMwh: parsed.data.tariff_brl_mwh }));
});

router.get('/sustainability/reports/:kind.pdf', requireAuth, async (req, res) => {
  const kind = req.params.kind === 'institutional' ? 'institutional' : req.params.kind === 'goals' ? 'goals' : null;
  if (!kind) return res.status(404).json({ error: { code: 'REPORT_NOT_FOUND', message: 'Relatório não encontrado.' } });
  const report = await createSustainabilityPdf({ organizationId: req.user.organizationId, kind });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${report.filename}"`, 'Cache-Control': 'no-store' });
  return res.send(report.buffer);
});
export default router;
