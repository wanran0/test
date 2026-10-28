import { monthlyReport, provider, groupOverview } from '../services/aiService.js';

// GET /api/ai/provider  —— 查看当前 AI 实现（placeholder / openai-compatible）
export async function getProvider(req, res) {
  res.json({
    provider: provider(),
    note:
      provider() === 'placeholder'
        ? '当前为离线占位实现：报告由真实记账数据套模板生成，未调用外部模型。配置 AI_BASE_URL/AI_API_KEY/AI_MODEL 可切 OpenAI 兼容接口。'
        : '已检测到 OpenAI 兼容配置；实际外呼尚未接入（见 aiService.js 的 TODO）。',
  });
}

// GET /api/dorms/:dormId/ai/report?month=YYYY-MM  —— 寝室费用月报（占位）
export async function getReport(req, res) {
  const month = req.query.month ? String(req.query.month) : null;
  res.json(monthlyReport(req.params.dormId, month));
}

// GET /api/ai/overview?month=  —— 群体概览（仍走匿名对比，受 k-匿名保护）
export async function getOverview(req, res) {
  res.json(groupOverview(req.query.month ? String(req.query.month) : null));
}
