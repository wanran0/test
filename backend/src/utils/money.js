// 金额工具：全程以「分」(整数) 计算，杜绝浮点误差。

// 元 -> 分
export const yuanToCents = (yuan) => Math.round(Number(yuan) * 100);
// 分 -> 元
export const centsToYuan = (cents) => Number(cents) / 100;

/**
 * 最大余额法 (largest remainder) 按权重把 totalCents 拆成整数份额，
 * 保证 sum(shares) === totalCents，且余数分配给小数部分最大的项。
 * @param {number} totalCents 非负整数总额(分)
 * @param {number[]} weights 各项权重(>0)，长度即参与分摊人数
 * @returns {number[]} 每项应付(分)
 */
export function splitByWeights(totalCents, weights) {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('totalCents 必须是非负整数(分)');
  }
  const w = weights.map(Number);
  if (w.length === 0 || w.some((x) => !(x > 0) || !Number.isFinite(x))) {
    throw new Error('weights 必须是长度为 N 的正数数组');
  }
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map((x) => (totalCents * x) / sum);
  const floors = raw.map(Math.floor);
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);
  // 按小数部分从大到小补 1 分
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = floors.slice();
  for (let k = 0; k < remainder; k++) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}
