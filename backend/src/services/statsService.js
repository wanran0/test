import { getDb } from '../db/index.js';
import { expenseRepo } from '../models/expenseRepo.js';
import { centsToYuan } from '../utils/money.js';

// 公开对比的最小样本量（k-匿名）：授权寝室少于该数时拒绝输出对比，防止被反推识别
export const MIN_CONSENTED_DORMS = 3;

const memberCountOf = (dormId) =>
  getDb().prepare('SELECT COUNT(*) AS n FROM dorm_member WHERE dorm_id = ?').get(dormId).n;

const safePerCapita = (cents, count) => (count > 0 ? Math.round(cents / count) : 0);
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

/** 单寝汇总：总额、按类别、按月及月人均（自查，不依赖他人授权）；month 传 YYYY-MM 则只算该月 */
export function dormSummary(dormId, month = null) {
  const memberCount = memberCountOf(dormId);
  const monthlyAll = expenseRepo.sumMonthly(dormId).map((m) => ({
    ...m,
    perCapitaCents: safePerCapita(m.total_cents, memberCount),
  }));
  const scoped = month ? monthlyAll.filter((m) => m.month === month) : monthlyAll;
  const totalCents = scoped.reduce((a, m) => a + m.total_cents, 0);
  return {
    dormId,
    month: month || null,
    memberCount,
    totalCents,
    totalYuan: centsToYuan(totalCents),
    byCategory: expenseRepo.sumByCategory(dormId, month),
    monthly: scoped,
  };
}

/** 已授权寝室的原始聚合行（内部用，含 dorm_id，绝不直接返回给客户端） */
function consentedRows(month) {
  const rows = month
    ? getDb()
        .prepare(
          `SELECT d.id AS dorm_id, d.gender,
                  (SELECT COUNT(*) FROM dorm_member m WHERE m.dorm_id = d.id) AS member_count,
                  (SELECT COALESCE(SUM(e.amount_cents), 0) FROM expense e
                     WHERE e.dorm_id = d.id AND substr(e.occurred_on,1,7) = ?) AS total_cents
           FROM dorm d WHERE d.report_consent = 1 ORDER BY d.id`
        )
        .all(month)
    : expenseRepo.sumsForConsentedDorms();

  if (rows.length < MIN_CONSENTED_DORMS) {
    const e = new Error(
      `已授权公开对比的寝室仅 ${rows.length} 个，少于 ${MIN_CONSENTED_DORMS} 个，为避免被识别暂不公开对比`
    );
    e.statusCode = 409;
    e.code = 'INSUFFICIENT_CONSENT_POOL';
    throw e;
  }
  return rows.map((r) => ({
    // 统一 dorm_id 键名（两处查询都以此别名输出），供后续精确排名
    dorm_id: r.dorm_id,
    gender: r.gender,
    member_count: r.member_count,
    total_cents: r.total_cents,
    perCapita: safePerCapita(r.total_cents, r.member_count),
  }));
}

const aliasOf = (dormId) => `寝室#${String(dormId).slice(0, 6)}`;

/**
 * 匿名横向对比：只输出稳定别名与聚合数字，不含寝室名与成员。
 * @param {string} [month] YYYY-MM，指定则只统计该月
 */
export function comparison(month) {
  const rows = consentedRows(month);
  const items = rows.map((r) => ({
    alias: aliasOf(r.dorm_id),
    gender: r.gender,
    memberCount: r.member_count,
    totalCents: r.total_cents,
    perCapitaCents: r.perCapita,
  }));

  const byGender = ['male', 'female', 'mixed', 'unknown']
    .map((g) => {
      const sub = rows.filter((r) => r.gender === g);
      return {
        gender: g,
        dormCount: sub.length,
        avgPerCapitaCents: avg(sub.map((r) => r.perCapita)),
      };
    })
    .filter((g) => g.dormCount > 0);

  return {
    month: month || null,
    consentedDormCount: items.length,
    overallAvgPerCapitaCents: avg(rows.map((r) => r.perCapita)),
    byGender,
    items,
  };
}

/**
 * 本寝对标：自身人均 vs 已授权群体均值/名次。
 * 未授权寝室可看到自己的数字与群体均值，但不会被列进公开对比。
 */
export function benchmark(dormId, month) {
  const self = getDb()
    .prepare(
      `SELECT d.id AS dorm_id, d.gender, d.report_consent,
              (SELECT COUNT(*) FROM dorm_member m WHERE m.dorm_id = d.id) AS member_count,
              (SELECT COALESCE(SUM(e.amount_cents), 0) FROM expense e
                 WHERE e.dorm_id = d.id AND (? IS NULL OR substr(e.occurred_on,1,7) = ?)) AS total_cents
       FROM dorm d WHERE d.id = ?`
    )
    .get(month, month, dormId);

  if (!self) {
    const e = new Error('寝室不存在');
    e.statusCode = 404;
    throw e;
  }
  const selfPerCapita = safePerCapita(self.total_cents, self.member_count);
  const result = {
    dormId,
    month: month || null,
    self: {
      memberCount: self.member_count,
      totalCents: self.total_cents,
      perCapitaCents: selfPerCapita,
      consentedToPublicCompare: !!self.report_consent,
    },
    pool: null,
    overallAvgPerCapitaCents: null,
    deltaCents: null,
    deltaPercent: null,
    rank: null,
  };

  // 群体数据需要足够的授权样本；不足时只返回本寝数据
  let rows;
  try {
    rows = consentedRows(month);
  } catch (e) {
    if (e.code === 'INSUFFICIENT_CONSENT_POOL') return { ...result, notice: e.message };
    throw e;
  }

  // 未授权的本寝也要能对标，临时并入计算集合（不对外暴露其身份）
  const pool = self.report_consent ? rows : [...rows, { ...self, perCapita: selfPerCapita }];
  const sorted = [...pool].sort((a, b) => b.perCapita - a.perCapita);
  const index = sorted.findIndex((r) => r.dorm_id === dormId);
  const mean = avg(pool.map((r) => r.perCapita));

  return {
    ...result,
    pool: { dormCount: pool.length },
    overallAvgPerCapitaCents: mean,
    deltaCents: selfPerCapita - mean,
    deltaPercent: mean ? Math.round(((selfPerCapita - mean) / mean) * 100) : 0,
    rank: index >= 0 ? `${index + 1}/${pool.length}` : null,
    note: self.report_consent
      ? null
      : '本寝未授权公开，不出现在他人可见的对比列表中（对标结果仍可用）',
  };
}
