import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

const CATEGORIES = ['feature', 'bug', 'experience', 'other'];
const STATUSES = ['open', 'acknowledged', 'planned', 'closed'];

export const feedbackRepo = {
  CATEGORIES,
  STATUSES,

  create({ dormId = null, userId, content, category = 'feature', rating = null }) {
    if (!CATEGORIES.includes(category)) {
      const e = new Error(`category 只能是 ${CATEGORIES.join('|')}`);
      e.statusCode = 400;
      throw e;
    }
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      const e = new Error('rating 需为 1-5 的整数');
      e.statusCode = 400;
      throw e;
    }
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO feedback (id, dorm_id, user_id, category, content, rating, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(id, dormId, userId, category, content, rating);
    return this.byId(id);
  },

  byId(id) {
    return getDb().prepare('SELECT * FROM feedback WHERE id = ?').get(id);
  },

  list({ dormId = null, status = null, limit = 100 } = {}) {
    const where = [];
    const args = [];
    if (dormId) {
      where.push('f.dorm_id = ?');
      args.push(dormId);
    }
    if (status) {
      where.push('f.status = ?');
      args.push(status);
    }
    const sql = `SELECT f.*, u.nickname AS from_nickname, d.name AS dorm_name
                 FROM feedback f
                 LEFT JOIN app_user u ON u.id = f.user_id
                 LEFT JOIN dorm d ON d.id = f.dorm_id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY f.created_at DESC LIMIT ?`;
    args.push(Number(limit));
    return getDb().prepare(sql).all(...args);
  },

  update({ id, status, reply, handledBy }) {
    if (status && !STATUSES.includes(status)) {
      const e = new Error(`status 只能是 ${STATUSES.join('|')}`);
      e.statusCode = 400;
      throw e;
    }
    const current = this.byId(id);
    if (!current) {
      const e = new Error('反馈不存在');
      e.statusCode = 404;
      throw e;
    }
    getDb()
      .prepare(
        `UPDATE feedback SET status = ?, reply = ?, handled_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        status || current.status,
        reply ?? current.reply,
        handledBy ?? current.handled_by,
        id
      );
    return this.byId(id);
  },

  /** 测评汇总：按状态/类别计数 + 平均处理时长，可直接写进课程测评文档 */
  summary() {
    const db = getDb();
    const byStatus = db
      .prepare('SELECT status, COUNT(*) AS n FROM feedback GROUP BY status')
      .all();
    const byCategory = db
      .prepare('SELECT category, COUNT(*) AS n, AVG(COALESCE(rating, 0)) AS avg_rating FROM feedback GROUP BY category')
      .all();
    const totals = db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status IN ('planned','closed') THEN 1 ELSE 0 END) AS adopted,
                SUM(CASE WHEN reply IS NOT NULL THEN 1 ELSE 0 END) AS replied,
                CAST(AVG(julianday(updated_at) - julianday(created_at)) * 24 AS REAL) AS avg_handle_hours
         FROM feedback`
      )
      .get();
    return { totals, byStatus, byCategory };
  },
};
