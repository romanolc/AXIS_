import { Router } from 'express';
import { z } from 'zod';
import { listRecommendations, applyRecommendation } from '../services/recommendation.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendData } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth);
router.get('/', async (req, res) => sendData(res, await listRecommendations(req.user.organizationId)));
router.patch('/:id', validate(z.object({ status: z.enum(['APPLIED', 'DISMISSED', 'OPEN']) })), async (req, res) => {
  const result = await applyRecommendation(req.params.id, req.user.organizationId, req.body.status);
  if (!result) return res.status(404).json({ error: { code: 'RECOMMENDATION_NOT_FOUND', message: 'Recomendação não encontrada.' } });
  return sendData(res, result);
});
export default router;
