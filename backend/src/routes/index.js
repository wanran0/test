import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireMember, requireInput } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as member from '../controllers/memberController.js';
import * as expense from '../controllers/expenseController.js';
import * as chore from '../controllers/choreController.js';

export const router = Router();

// 健康检查
router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 公开：登录
router.post('/auth/login', asyncHandler(auth.login));

// 以下需登录
router.use(requireAuth);

router.post('/dorms', asyncHandler(auth.createDorm));

// 寝室维度：先校验成员身份
router.param('dormId', (req, res, next, dormId) => {
  req.dormId = dormId;
  next();
});
const memberCheck = requireMember('dormId');

router.get('/dorms/:dormId/members', memberCheck, asyncHandler(member.listMembers));
router.post('/dorms/:dormId/members', memberCheck, requireInput, asyncHandler(member.addMember));

router.get('/dorms/:dormId/categories', memberCheck, asyncHandler(expense.listCategories));
router.post('/dorms/:dormId/categories', memberCheck, requireInput, asyncHandler(expense.addCategory));

router.get('/dorms/:dormId/expenses', memberCheck, asyncHandler(expense.listExpenses));
router.post('/dorms/:dormId/expenses', memberCheck, requireInput, asyncHandler(expense.createExpense));

router.get('/dorms/:dormId/chores', memberCheck, asyncHandler(chore.listChores));
router.post('/dorms/:dormId/chores', memberCheck, requireInput, asyncHandler(chore.createChore));

// 全局维度（仍需登录；权限细化留 TODO）
router.get('/expenses/:expenseId', asyncHandler(expense.getExpense));
router.get('/chores/:choreId/schedule', asyncHandler(chore.getSchedule));
