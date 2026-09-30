import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'VIEWER', organizationId: user.organization_id || null },
    env.jwtSecret,
    { expiresIn: '8h', issuer: 'axis-api' }
  );
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.slice(7), env.jwtSecret, { issuer: 'axis-api' }); } catch { /* request remains anonymous */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } });
  next();
}
