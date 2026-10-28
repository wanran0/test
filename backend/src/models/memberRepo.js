import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const memberRepo = {
  add({ dormId, userId, role = 'member', canInput = 1, canEdit = 0 }) {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO dorm_member (id, dorm_id, user_id, role, can_input, can_edit)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, dormId, userId, role, canInput ? 1 : 0, canEdit ? 1 : 0);
    return this.byId(id);
  },
  byId(id) {
    return getDb().prepare('SELECT * FROM dorm_member WHERE id = ?').get(id);
  },
  listByDorm(dormId) {
    return getDb()
      .prepare(
        `SELECT m.*, u.nickname FROM dorm_member m
         JOIN app_user u ON u.id = m.user_id
         WHERE m.dorm_id = ? ORDER BY m.joined_at`
      )
      .all(dormId);
  },
};
