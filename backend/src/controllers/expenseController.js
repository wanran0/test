import { expenseRepo } from '../models/expenseRepo.js';
import { memberRepo } from '../models/memberRepo.js';
import { computeShares } from '../services/splitService.js';
import { yuanToCents } from '../utils/money.js';

// GET /api/dorms/:dormId/categories
export async function listCategories(req, res) {
  res.json({ categories: expenseRepo.listCategories(req.params.dormId) });
}

// POST /api/dorms/:dormId/categories  { name, defaultSplitMode }
export async function addCategory(req, res) {
  if (!req.body.name) {
    const e = new Error('缺少类别名称 name');
    e.statusCode = 400;
    throw e;
  }
  const category = expenseRepo.addCategory({
    dormId: req.params.dormId,
    name: req.body.name,
    defaultSplitMode: req.body.defaultSplitMode,
  });
  res.status(201).json({ category });
}

// POST /api/dorms/:dormId/expenses
// { title, amountYuan|amountCents, payerMemberId, splitMode, participants?, categoryId?, occurredOn, note }
export async function createExpense(req, res) {
  const dormId = req.params.dormId;
  const b = req.body || {};

  const amountCents =
    b.amountCents != null ? Number(b.amountCents) : yuanToCents(b.amountYuan);
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    const e = new Error('金额无效：请提供 amountYuan 或 amountCents');
    e.statusCode = 400;
    throw e;
  }

  const splitMode = b.splitMode || 'equal';
  // 默认全体寝室成员均摊
  let participants = b.participants;
  if (!participants || participants.length === 0) {
    participants = memberRepo.listByDorm(dormId).map((m) => ({ memberId: m.id }));
  }

  const shares = computeShares({ amountCents, mode: splitMode, participants });

  const created = expenseRepo.createWithShares({
    expense: {
      dormId,
      categoryId: b.categoryId || null,
      title: b.title || '未命名支出',
      amountCents,
      payerMemberId: b.payerMemberId || req.member.id,
      splitMode,
      occurredOn: b.occurredOn || new Date().toISOString().slice(0, 10),
      note: b.note,
    },
    shares: shares.map((s, i) => ({ ...s, weight: participants[i]?.weight ?? 1 })),
  });

  res.status(201).json({ expense: created });
}

// GET /api/dorms/:dormId/expenses
export async function listExpenses(req, res) {
  res.json({ expenses: expenseRepo.listByDorm(req.params.dormId) });
}

// GET /api/expenses/:expenseId
export async function getExpense(req, res) {
  const expense = expenseRepo.byId(req.params.expenseId);
  if (!expense) {
    const e = new Error('费用不存在');
    e.statusCode = 404;
    throw e;
  }
  res.json({ expense });
}
