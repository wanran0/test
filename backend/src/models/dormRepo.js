import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const dormRepo = {
  create({ name, gender, ownerId }) {
    const id = newId();
    getDb()
      .prepare('INSERT INTO dorm (id, name, gender, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, name, gender || 'unknown', ownerId);
    return this.byId(id);
  },
  byId(id) {
    return getDb().prepare('SELECT * FROM dorm WHERE id = ?').get(id);
  },
  listByOwner(userId) {
    return getDb().prepare('SELECT * FROM dorm WHERE owner_id = ?').all(userId);
  },
  // 费用对比公开授权：由宿舍长开启/撤回
  setConsent(dormId, on) {
    getDb()
      .prepare('UPDATE dorm SET report_consent = ?, consented_at = ? WHERE id = ?')
      .run(on ? 1 : 0, on ? new Date().toISOString() : null, dormId);
    return this.byId(dormId);
  },
  // 仅返回已授权的寝室（匿名对比的唯一数据源）
  listConsented() {
    return getDb().prepare('SELECT * FROM dorm WHERE report_consent = 1').all();
  },
};
