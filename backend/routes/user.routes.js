import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getProfile } from '../services/auth.service.js';
import { db } from '../database/client.js';
import { demoStore } from '../database/demo-store.js';
import { validate } from '../middleware/validate.js';
import { sendData } from '../utils/helpers.js';

const router = Router();
const profileSchema = z.object({ name: z.string().min(2).max(120), avatar_url: z.string().url().nullable().optional() });
const prefSchema = z.record(z.boolean().or(z.string()).or(z.number()));
router.use(requireAuth);
router.get('/profile', async (req, res) => sendData(res, await getProfile(req.user.sub)));
router.patch('/profile', validate(profileSchema), async (req, res) => {
  if (!db.enabled) { Object.assign(demoStore.user, req.body); return sendData(res, demoStore.user); }
  const result = await db.query('UPDATE users SET name = COALESCE($1,name), avatar_url = COALESCE($2,avatar_url), updated_at = NOW() WHERE id = $3 RETURNING *', [req.body.name, req.body.avatar_url, req.user.sub]);
  return sendData(res, result.rows[0]);
});
router.get('/preferences', async (req, res) => sendData(res, db.enabled ? ((await db.query('SELECT preferences FROM user_preferences WHERE user_id=$1', [req.user.sub])).rows[0]?.preferences || {}) : demoStore.preferences));
router.patch('/preferences', validate(prefSchema), async (req, res) => {
  if (!db.enabled) { Object.assign(demoStore.preferences, req.body); return sendData(res, demoStore.preferences); }
  const result = await db.query('INSERT INTO user_preferences (user_id, preferences) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET preferences=EXCLUDED.preferences, updated_at=NOW() RETURNING preferences', [req.user.sub, req.body]);
  return sendData(res, result.rows[0].preferences);
});
export default router;
