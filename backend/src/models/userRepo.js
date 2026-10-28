import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const userRepo = {
  byId(id) {
    return getDb().prepare('SELECT * FROM app_user WHERE id = ?').get(id);
  },
  byOpenid(openid) {
    return getDb().prepare('SELECT * FROM app_user WHERE openid = ?').get(openid);
  },
  upsertByOpenid({ openid, nickname, isAdmin = false }) {
    const existing = this.byOpenid(openid);
    if (existing) {
      // 白名单可能在既有账号之后才配置，登录时按需升级
      if (isAdmin && !existing.is_admin) this.setAdmin(existing.id, true);
      return this.byId(existing.id);
    }
    const id = newId();
    getDb()
      .prepare('INSERT INTO app_user (id, openid, nickname, is_admin) VALUES (?, ?, ?, ?)')
      .run(id, openid, nickname, isAdmin ? 1 : 0);
    return this.byId(id);
  },
  setAdmin(id, isAdmin) {
    getDb().prepare('UPDATE app_user SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
    return this.byId(id);
  },
};
