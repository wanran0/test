import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const config = {
  root,
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'app.db'),
  authSecret: process.env.AUTH_SECRET || 'dev-secret-change-me',
  wx: {
    appId: process.env.WX_APPID || '',
    appSecret: process.env.WX_APPSECRET || '',
  },
  // 开发组管理员：登录 code 命中即授予 is_admin（反馈处理与测评汇总用）
  // 未配置时回退到开发默认 code，便于本地/冒烟测试；启动会打印告警
  adminCodes: (() => {
    const list = (process.env.ADMIN_CODES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length ? list : ['dev-admin'];
  })(),
  adminCodesAreDevDefault: !(process.env.ADMIN_CODES || '').trim(),
  ai: {
    // 占位实现；配好 baseURL/apiKey/model 后可切 OpenAI 兼容接口
    baseURL: process.env.AI_BASE_URL || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
  },
};
