import { splitByWeights } from '../utils/money.js';

/**
 * 计算一笔费用每位成员应付(分)。
 * @param {object} expense
 *   - amountCents: number 总额(分)
 *   - mode: 'equal' | 'ratio' | 'designated'
 *   - participants: Array<{ memberId, weight? , cents? }>
 * @returns {Array<{ memberId, shareCents }>} 合计严格等于 amountCents
 */
export function computeShares({ amountCents, mode, participants }) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw badRequest('至少需要一位参与分摊的成员');
  }

  if (mode === 'designated') {
    // 直接指定每人金额，校验合计
    const shares = participants.map((p) => ({
      memberId: p.memberId,
      shareCents: Math.round(Number(p.cents)),
    }));
    const total = shares.reduce((a, s) => a + s.shareCents, 0);
    if (total !== amountCents) {
      throw badRequest(`指定金额合计 ${total} 与总额 ${amountCents} 不符`);
    }
    return shares;
  }

  // equal: 权重全为 1；ratio: 用每人 weight(缺省 1)
  const weights = participants.map((p) => (mode === 'ratio' ? Number(p.weight ?? 1) : 1));
  try {
    const cents = splitByWeights(amountCents, weights);
    return participants.map((p, i) => ({ memberId: p.memberId, shareCents: cents[i] }));
  } catch (e) {
    throw badRequest(e.message);
  }
}

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}
