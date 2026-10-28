import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const userRepo = {
  byId(id) {
    return getDb().prepare('SELECT * FROM app_user WHERE id = ?').get(id);
  },
  byOpenid(openid) {
    return getDb().prepare('SELECT * FROM app_user WHERE openid = ?').get(openid);
  },
  upsertByOpenid({ openid, nickname }) {
    const existing = this.byOpenid(openid);
    if (existing) return existing;
    const id = newId();
    getDb().prepare('INSERT INTO app_user (id, openid, nickname) VALUES (?, ?, ?)').run(id, openid, nickname);
    return this.byId(id);
  },
};
