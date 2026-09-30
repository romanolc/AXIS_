import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = !env.demoMode && env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl, ssl: env.databaseSsl ? { rejectUnauthorized: false } : false })
  : null;

export const db = {
  enabled: Boolean(pool),
  async query(text, params = []) {
    if (!pool) throw new Error('DATABASE_URL is not configured');
    return pool.query(text, params);
  },
  async transaction(callback) {
    if (!pool) throw new Error('DATABASE_URL is not configured');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

export async function closeDatabase() {
  if (pool) await pool.end();
}
