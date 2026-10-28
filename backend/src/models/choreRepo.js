import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const choreRepo = {
  create({ dormId, name, cycle, baseDate, rotationMembers }) {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO chore (id, dorm_id, name, cycle, base_date, rotation_members)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, dormId, name, cycle, baseDate, JSON.stringify(rotationMembers));
    return this.byId(id);
  },

  byId(id) {
    const row = getDb().prepare('SELECT * FROM chore WHERE id = ?').get(id);
    if (!row) return null;
    row.rotation_members = JSON.parse(row.rotation_members);
    return row;
  },

  listByDorm(dormId) {
    return getDb().prepare('SELECT * FROM chore WHERE dorm_id = ?').all(dormId).map((row) => ({
      ...row,
      rotation_members: JSON.parse(row.rotation_members),
    }));
  },

  saveAssignments(choreId, assignments) {
    const db = getDb();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO chore_assignment (id, chore_id, dorm_member_id, due_date, rotation_index)
       VALUES (?, ?, ?, ?, ?)`
    );
    db.exec('BEGIN');
    try {
      for (const a of assignments) ins.run(newId(), choreId, a.memberId, a.dueDate, a.rotationIndex);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },

  listAssignments(choreId) {
    return getDb()
      .prepare('SELECT * FROM chore_assignment WHERE chore_id = ? ORDER BY due_date')
      .all(choreId);
  },
};
