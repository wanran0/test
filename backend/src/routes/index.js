import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import {
  requireAuth,
  requireMember,
  requireInput,
  requireAdmin,
  requireDormHead,
} from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as member from '../controllers/memberController.js';
import * as expense from '../controllers/expenseController.js';
import * as chore from '../controllers/choreController.js';
import * as stats from '../controllers/statsController.js';
import * as feedback from '../controllers/feedbackController.js';
import * as ai from '../controllers/aiController.js';

export const router = Router();

// 健康检查
router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 公开：登录
router.post('/auth/login', asyncHandler(auth.login));

// 以下需登录
router.use(requireAuth);

router.post('/dorms', asyncHandler(auth.createDorm));

// ---------- 开发组管理员：反馈处理与测评汇总 ----------
// 注意：/admin/feedback/summary 必须在 /admin/feedback/:id 之前注册
router.get('/admin/feedback/summary', requireAdmin, asyncHandler(feedback.adminSummary));
router.get('/admin/feedback', requireAdmin, asyncHandler(feedback.adminList));
router.patch('/admin/feedback/:id', requireAdmin, asyncHandler(feedback.adminUpdate));

// ---------- 全局统计与 AI ----------
router.get('/stats/compare', asyncHandler(stats.getCompare)); // 仅匿名聚合
router.get('/ai/provider', asyncHandler(ai.getProvider));
router.get('/ai/overview', asyncHandler(ai.getOverview));

// ---------- 寝室维度：先校验成员身份 ----------
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

router.get('/dorms/:dormId/stats/self', memberCheck, asyncHandler(stats.getSelf));
router.get('/dorms/:dormId/stats/benchmark', memberCheck, asyncHandler(stats.getBenchmark));
router.get('/dorms/:dormId/ai/report', memberCheck, asyncHandler(ai.getReport));
router.get('/dorms/:dormId/feedback', memberCheck, asyncHandler(feedback.listForDorm));

// 公开授权开关：仅宿舍长
router.put('/dorms/:dormId/consent', memberCheck, requireDormHead('dormId'), asyncHandler(stats.putConsent));

// ---------- 反馈提交（可关联自己的寝室，也可不关联） ----------
router.post('/feedback', asyncHandler(feedback.submit));

// ---------- 全局维度（仍需登录；细粒度归属校验留 TODO） ----------
router.get('/expenses/:expenseId', asyncHandler(expense.getExpense));
router.get('/chores/:choreId/schedule', asyncHandler(chore.getSchedule));
