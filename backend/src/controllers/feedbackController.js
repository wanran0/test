import { feedbackRepo } from '../models/feedbackRepo.js';
import { getDb } from '../db/index.js';

// POST /api/feedback  { content, category?, rating?, dormId? }  —— 任何登录用户可提
export async function submit(req, res) {
  const { content, category, rating, dormId } = req.body || {};
  if (!content || !String(content).trim()) {
    const e = new Error('反馈内容 content 不能为空');
    e.statusCode = 400;
    throw e;
  }
  if (dormId) {
    const inDorm = getDb()
      .prepare('SELECT id FROM dorm_member WHERE dorm_id = ? AND user_id = ?')
      .get(dormId, req.user.id);
    if (!inDorm) {
      const e = new Error('只能为自己所在寝室提交关联反馈');
      e.statusCode = 403;
      throw e;
    }
  }
  const feedback = feedbackRepo.create({
    dormId: dormId || null,
    userId: req.user.id,
    content: String(content).trim(),
    category: category || 'feature',
    rating: rating != null ? Number(rating) : null,
  });
  res.status(201).json({ feedback });
}

// GET /api/dorms/:dormId/feedback?status=  —— 成员可见本寝反馈
export async function listForDorm(req, res) {
  res.json({
    feedback: feedbackRepo.list({
      dormId: req.params.dormId,
      status: req.query.status || null,
    }),
  });
}

// GET /api/admin/feedback?status=&limit=  —— 管理员查看全部
export async function adminList(req, res) {
  res.json({
    feedback: feedbackRepo.list({
      status: req.query.status || null,
      limit: req.query.limit || 100,
    }),
  });
}

// PATCH /api/admin/feedback/:id  { status?, reply? }  —— 处理并回复
export async function adminUpdate(req, res) {
  const updated = feedbackRepo.update({
    id: req.params.id,
    status: req.body?.status,
    reply: req.body?.reply,
    handledBy: req.user.id,
  });
  res.json({ feedback: updated });
}

// GET /api/admin/feedback/summary  —— 测评汇总（数量、采纳率、平均处理时长）
export async function adminSummary(req, res) {
  res.json({ summary: feedbackRepo.summary(), categories: feedbackRepo.CATEGORIES, statuses: feedbackRepo.STATUSES });
}
