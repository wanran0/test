const DAY_MS = 86400000;

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(dt) {
  return dt.toISOString().slice(0, 10);
}

/**
 * 循环队列/取模排班：为 [fromDate, toDate] 逐期生成值日安排。
 * @param {object} chore
 *   - cycle: 'daily' | 'weekly'
 *   - baseDate: 'YYYY-MM-DD' 轮换起点（该日对应 rotation_index 0）
 *   - rotationMembers: string[] 有序成员 id（队列，长度 N）
 *   - fromDate / toDate: 'YYYY-MM-DD' 生成区间(含端点)
 * @returns {Array<{ dueDate, memberId, rotationIndex }>}
 */
export function generateAssignments({ cycle, baseDate, rotationMembers, fromDate, toDate }) {
  const members = rotationMembers || [];
  if (members.length === 0) throw new Error('轮换成员队列为空');
  if (!['daily', 'weekly'].includes(cycle)) throw new Error('cycle 只能是 daily 或 weekly');

  const base = parseDate(baseDate);
  const start = parseDate(fromDate);
  const end = parseDate(toDate);
  const stepDays = cycle === 'weekly' ? 7 : 1;

  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += stepDays * DAY_MS) {
    const periods = Math.floor((t - base.getTime()) / (stepDays * DAY_MS));
    const rotationIndex = ((periods % members.length) + members.length) % members.length;
    out.push({
      dueDate: fmtDate(new Date(t)),
      memberId: members[rotationIndex],
      rotationIndex,
    });
  }
  return out;
}
