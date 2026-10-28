import { dormRepo } from '../models/dormRepo.js';
import { dormSummary, benchmark, comparison, MIN_CONSENTED_DORMS } from '../services/statsService.js';

const monthOf = (req) => (req.query.month ? String(req.query.month) : null);

// GET /api/dorms/:dormId/stats/self?month=YYYY-MM  —— 本寝汇总，任何成员可看，不需授权
export async function getSelf(req, res) {
  res.json({ summary: dormSummary(req.params.dormId, monthOf(req)) });
}

// GET /api/dorms/:dormId/stats/benchmark?month=  —— 本寝 vs 已授权群体均值/名次
export async function getBenchmark(req, res) {
  res.json({ benchmark: benchmark(req.params.dormId, monthOf(req)) });
}

// GET /api/stats/compare?month=  —— 已授权寝室的匿名横向对比（不含寝室名/成员）
export async function getCompare(req, res) {
  const data = comparison(monthOf(req));
  res.json({ ...data, minConsentedDorms: MIN_CONSENTED_DORMS });
}

// PUT /api/dorms/:dormId/consent  { reportConsent: true|false }  —— 仅宿舍长可开关公开授权
export async function putConsent(req, res) {
  const on = req.body?.reportConsent;
  if (typeof on !== 'boolean') {
    const e = new Error('reportConsent 必须是布尔值');
    e.statusCode = 400;
    throw e;
  }
  const dorm = dormRepo.setConsent(req.params.dormId, on);
  res.json({
    dormId: dorm.id,
    reportConsent: !!dorm.report_consent,
    consentedAt: dorm.consented_at,
    message: on ? '已同意公开匿名费用对比' : '已撤回公开授权，将从对比池中移除',
  });
}
