import { Router } from 'express';
import { z } from 'zod';
import { login, getProfile } from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { sendData } from '../utils/helpers.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function loginKey(req) {
  return `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
}

function tooManyLoginAttempts(req) {
  const now = Date.now();
  const key = loginKey(req);
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 0 });
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(req) {
  const key = loginKey(req);
  const entry = loginAttempts.get(key) || { startedAt: Date.now(), count: 0 };
  entry.count += 1;
  loginAttempts.set(key, entry);
}

function clearLoginAttempts(req) {
  loginAttempts.delete(loginKey(req));
}

router.post('/login', validate(loginSchema), async (req, res) => {
  if (tooManyLoginAttempts(req)) {
    res.set('Retry-After', String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
    return res.status(429).json({ error: { code: 'LOGIN_RATE_LIMITED', message: 'Muitas tentativas de login. Tente novamente em instantes.' } });
  }
  const result = await login(req.body);
  if (!result) {
    recordFailedLogin(req);
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } });
  }
  clearLoginAttempts(req);
  return sendData(res, result);
});
router.post('/logout', requireAuth, (_req, res) => sendData(res, { success: true }));
router.get('/me', requireAuth, async (req, res) => sendData(res, await getProfile(req.user.sub)));
router.post('/password-recovery', validate(z.object({ email: z.string().email() })), (_req, res) => sendData(res, { accepted: true, message: 'Se o e-mail existir, as instruções serão enviadas.' }));
export default router;
