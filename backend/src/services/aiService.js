import { config } from '../config.js';
import { dormSummary, benchmark, comparison } from './statsService.js';
import { centsToYuan } from '../utils/money.js';

/** 当前生效的实现：无密钥 -> 离线占位；配置后 -> OpenAI 兼容接口 */
export function provider() {
  return config.ai.baseURL && config.ai.apiKey && config.ai.model ? 'openai-compatible' : 'placeholder';
}

const yuan = (cents) => `¥${centsToYuan(cents).toFixed(2)}`;

/**
 * 组装给 AI 的提示词。真实接入时直接把这段丢给模型即可，
 * 因此即使是占位实现，这部分也是可交付、可答辩的成果。
 */
export function buildPrompt({ summary, bench, month }) {
  const lines = [
    `你是宿舍财务管理助手。请基于以下数据，为寝室生成${month}的公共费用月报。`,
    '要求：先给结论，再给原因推测与可执行建议，语气客观，不臆造数据。',
    '',
    `【本寝数据】周期 ${month}，成员 ${summary.memberCount} 人，合计 ${yuan(summary.totalCents)}。`,
    `按月人均 ${yuan(bench.self.perCapitaCents)}。`,
    '按类别：',
    ...summary.byCategory.map((c) => `  - ${c.name}：${yuan(c.total_cents)}（${c.entries} 笔）`),
  ];
  if (bench.overallAvgPerCapitaCents != null) {
    lines.push(
      `【群体对标】已授权寝室 ${bench.pool?.dormCount ?? '-'} 个，群体人均 ${yuan(bench.overallAvgPerCapitaCents)}，`,
      `本寝相对均值 ${bench.deltaCents >= 0 ? '高' : '低'} ${Math.abs(bench.deltaPercent)}%，名次 ${bench.rank ?? '-'}。`
    );
  } else {
    lines.push('【群体对标】暂无（授权样本不足或数据缺失），请勿进行横向比较。');
  }
  return lines.join('\n');
}

/**
 * 占位实现：用统计数字套模板产出报告，零网络、零密钥即可演示。
 * TODO(接入真实 AI)：provider() === 'openai-compatible' 时，
 *   用 fetch(config.ai.baseURL + '/chat/completions', { method:'POST',
 *   headers:{ authorization:`Bearer ${config.ai.apiKey}` },
 *   body: JSON.stringify({ model: config.ai.model, messages:[{role:'user',content:prompt}] }) })
 *   取 choices[0].message.content 作为 report，并把 provider 标记为真实值。
 */
function renderPlaceholderReport({ summary, bench, month }) {
  const top = summary.byCategory[0];
  const parts = [
    `# ${month} 寝室公共费用月报`,
    '',
    `- 本月合计 **${yuan(summary.totalCents)}**，成员 ${summary.memberCount} 人，人均 **${yuan(bench.self.perCapitaCents)}**。`,
    top ? `- 支出最高类别为 **${top.name}**，${yuan(top.total_cents)}（${top.entries} 笔），占比 ${
      summary.totalCents ? Math.round((top.total_cents / summary.totalCents) * 100) : 0
    }%。` : '- 本月暂无支出记录。',
  ];

  if (bench.overallAvgPerCapitaCents != null) {
    const cmpText =
      bench.deltaCents === 0
        ? '与已授权寝室群体人均（' + yuan(bench.overallAvgPerCapitaCents) + '）**基本持平**'
        : `与已授权寝室群体人均（${yuan(bench.overallAvgPerCapitaCents)}）相比**${
            bench.deltaCents > 0 ? '高出' : '低出'
          }** ${Math.abs(bench.deltaPercent)}%`;
    parts.push(`- ${cmpText}，名次 ${bench.rank ?? '-'}。`);
    if (bench.deltaPercent > 20) {
      parts.push('- 提示：本寝人均明显偏高，建议核对是否存在单人大功率设备或使用频次差异，并考虑改为按比例分摊。');
    } else if (bench.deltaPercent < -20) {
      parts.push('- 提示：本寝人均偏低，可作为节约范例在总结中说明做法。');
    } else {
      parts.push('- 提示：本寝人均处于群体正常区间，维持现有习惯即可。');
    }
  } else {
    parts.push(`- ${bench.notice || '暂无可对标群体（授权样本不足），本期不做横向比较。'}`);
  }

  parts.push(
    '',
    '> 本报告由离线占位模板基于真实记账数据生成，未调用外部 AI 模型。',
    '> 说明：导师意见中「AI 生成月报」属后期可选增强，当前仅保留接口与提示词组装，待真实需求验证后接入。'
  );
  return parts.join('\n');
}

/** 生成某寝某月报告（占位实现，零网络零密钥即可演示） */
export function monthlyReport(dormId, month = null) {
  const summary = dormSummary(dormId, month);

  let bench;
  try {
    bench = benchmark(dormId, month);
  } catch (e) {
    if (e.statusCode === 404) throw e;
    bench = { self: { perCapitaCents: 0 }, overallAvgPerCapitaCents: null, rank: null, notice: e.message };
  }

  const prompt = buildPrompt({ summary, bench, month: month || '全部' });
  return {
    provider: provider(),
    dormId,
    month: month || null,
    data: { summary, benchmark: bench },
    prompt,
    report: renderPlaceholderReport({ summary, bench, month: month || '累计' }),
    generatedAt: new Date().toISOString(),
  };
}

/** 群体概览（供 AI 或报告引用，仍走匿名对比） */
export function groupOverview(month) {
  return comparison(month || null);
}
