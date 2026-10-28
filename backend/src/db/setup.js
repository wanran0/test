import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './index.js';
import { runMigrations } from './migrate.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 建表 + 列迁移，重复调用安全
export function ensureSchema() {
  const db = getDb();
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const added = runMigrations(db);
  return { dbPath: config.dbPath, added };
}
