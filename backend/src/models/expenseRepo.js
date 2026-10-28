import { getDb } from '../db/index.js';
import { newId } from '../utils/ids.js';

export const expenseRepo = {
  // 预置水/电类别（导师意见：刨不掉的项目预制在模板，允许再追加自定义）
  seedPresetCategories(dormId) {
    const stmt = getDb().prepare(
      `INSERT OR IGNORE INTO expense_category (id, dorm_id, name, is_preset, default_split_mode)
       VALUES (?, ?, ?, 1, 'equal')`
    );
    for (const name of ['电费', '水费']) stmt.run(newId(), dormId, name);
  },

  listCategories(dormId) {
    return getDb()
      .prepare('SELECT * FROM expense_category WHERE dorm_id = ? ORDER BY is_preset DESC, name')
      .all(dormId);
  },

  addCategory({ dormId, name, defaultSplitMode = 'equal' }) {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO expense_category (id, dorm_id, name, is_preset, default_split_mode)
         VALUES (?, ?, ?, 0, ?)`
      )
      .run(id, dormId, name, defaultSplitMode);
    return getDb().prepare('SELECT * FROM expense_category WHERE id = ?').get(id);
  },

  // 事务写入 expense + 计算好的 shares
  createWithShares({ expense, shares }) {
    const db = getDb();
    const expenseId = newId();
    db.exec('BEGIN');
    try {
      db.prepare(
        `INSERT INTO expense (id, dorm_id, category_id, title, amount_cents, payer_member_id, split_mode, occurred_on, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        expenseId,
        expense.dormId,
        expense.categoryId || null,
        expense.title,
        expense.amountCents,
        expense.payerMemberId,
        expense.splitMode,
        expense.occurredOn,
        expense.note || null
      );
      const ins = db.prepare(
        `INSERT INTO expense_share (id, expense_id, dorm_member_id, weight, share_cents)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const s of shares) {
        ins.run(newId(), expenseId, s.memberId, s.weight ?? 1, s.shareCents);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return this.byId(expenseId);
  },

  byId(id) {
    const db = getDb();
    const expense = db.prepare('SELECT * FROM expense WHERE id = ?').get(id);
    if (!expense) return null;
    expense.shares = db
      .prepare('SELECT * FROM expense_share WHERE expense_id = ?')
      .all(id);
    return expense;
  },

  listByDorm(dormId) {
    return getDb()
      .prepare('SELECT * FROM expense WHERE dorm_id = ? ORDER BY occurred_on DESC')
      .all(dormId);
  },

  // 统计用聚合：单寝按类别合计（可限定 YYYY-MM）
  sumByCategory(dormId, month = null) {
    return getDb()
      .prepare(
        `SELECT COALESCE(c.name, '未分类') AS name, SUM(e.amount_cents) AS total_cents,
                COUNT(*) AS entries
         FROM expense e LEFT JOIN expense_category c ON c.id = e.category_id
         WHERE e.dorm_id = ? AND (? IS NULL OR substr(e.occurred_on,1,7) = ?)
         GROUP BY c.name ORDER BY total_cents DESC`
      )
      .all(dormId, month, month);
  },

  // 统计用聚合：单寝按月合计
  sumMonthly(dormId) {
    return getDb()
      .prepare(
        `SELECT substr(occurred_on, 1, 7) AS month, SUM(amount_cents) AS total_cents
         FROM expense WHERE dorm_id = ? GROUP BY month ORDER BY month`
      )
      .all(dormId);
  },

  // 匿名对比用：仅已授权寝室的总额与人数（用子查询避免 join 放大）
  sumsForConsentedDorms() {
    return getDb()
      .prepare(
        `SELECT d.id AS dorm_id, d.gender,
                (SELECT COUNT(*) FROM dorm_member m WHERE m.dorm_id = d.id) AS member_count,
                (SELECT COALESCE(SUM(e.amount_cents), 0) FROM expense e WHERE e.dorm_id = d.id) AS total_cents,
                (SELECT COUNT(*) FROM expense e WHERE e.dorm_id = d.id) AS expense_count
         FROM dorm d WHERE d.report_consent = 1 ORDER BY d.id`
      )
      .all();
  },

  // 匿名对比用：已授权寝室的月度总额（供人均月度趋势与均值）
  monthlyForConsentedDorms() {
    return getDb()
      .prepare(
        `SELECT e.dorm_id, substr(e.occurred_on, 1, 7) AS month, SUM(e.amount_cents) AS total_cents
         FROM expense e WHERE e.dorm_id IN (SELECT id FROM dorm WHERE report_consent = 1)
         GROUP BY e.dorm_id, month ORDER BY month`
      )
      .all();
  },
};
