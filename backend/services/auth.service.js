import argon2 from 'argon2';
import { db } from '../database/client.js';
import { demoStore, getDemoUser } from '../database/demo-store.js';
import { signAccessToken } from '../middleware/auth.js';
import { DEMO_EMAIL, DEMO_PASSWORD_HASH } from '../config/demo-credentials.js';

async function verifyPassword(hash, password) {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

export async function login({ email, password }) {
  if (!db.enabled && email.toLowerCase() === DEMO_EMAIL && await verifyPassword(DEMO_PASSWORD_HASH, password)) {
    return { user: getDemoUser(), accessToken: signAccessToken(getDemoUser()), demo: true };
  }
  if (!db.enabled) return null;
  const result = await db.query('SELECT u.*, uo.organization_id, uo.role AS organization_role FROM users u LEFT JOIN user_organizations uo ON uo.user_id = u.id WHERE lower(u.email) = lower($1) LIMIT 1', [email]);
  const user = result.rows[0];
  if (!user || !user.password_hash) return null;
  if (!(await verifyPassword(user.password_hash, password))) return null;
  return { user: { ...user, role: user.organization_role || user.role }, accessToken: signAccessToken(user), demo: false };
}

export async function getProfile(userId) {
  if (!db.enabled) return demoStore.user;
  const result = await db.query('SELECT u.*, o.name AS organization_name, uo.role AS organization_role FROM users u LEFT JOIN user_organizations uo ON uo.user_id = u.id LEFT JOIN organizations o ON o.id = uo.organization_id WHERE u.id = $1', [userId]);
  return result.rows[0] || null;
}
