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
};
