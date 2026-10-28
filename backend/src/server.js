import { createApp } from './app.js';
import { config } from './config.js';
import { getDb } from './db/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 启动即确保 schema 就绪（骨架免手动 migrate）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
getDb().exec(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));

createApp().listen(config.port, () => {
  console.log(`[server] 宿舍生活分摊工具 backend 已启动: http://localhost:${config.port}/api/health`);
});
