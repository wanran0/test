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
};
