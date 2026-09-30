import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDatabase } from '../backend/database/client.js';

if (!db.enabled) {
  console.error('DATABASE_URL não configurada. Configure .env antes de executar a migração.');
  process.exitCode = 1;
} else {
  const filename = fileURLToPath(import.meta.url);
  const sql = await fs.readFile(path.join(path.dirname(filename), '../backend/database/migrations/001_initial.sql'), 'utf8');
  await db.query(sql);
  console.log('Migração 001_initial aplicada.');
}
await closeDatabase();
