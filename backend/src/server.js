import { createApp } from './app.js';
import { config } from './config.js';
import { ensureSchema } from './db/setup.js';
import { provider } from './services/aiService.js';

// 启动即确保 schema 与列迁移就绪（骨架免手动 migrate）
const { added } = ensureSchema();
if (added.length) console.log('[db] migrated columns:', added.join(', '));

if (config.adminCodesAreDevDefault) {
  console.warn(`[warn] 未设置 ADMIN_CODES，使用开发默认管理员 code「${config.adminCodes.join('」「')}」`);
}
console.log(`[ai] provider = ${provider()}`);

createApp().listen(config.port, () => {
  console.log(`[server] 宿舍生活分摊工具 backend 已启动: http://localhost:${config.port}/api/health`);
});
