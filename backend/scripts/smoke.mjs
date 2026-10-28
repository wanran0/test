// 冒烟测试：先启动服务 (npm start)，再 node scripts/smoke.mjs（或 npm run smoke）
// 覆盖：登录/建寝/权限/预置类别/三种分摊/排班轮换/反馈全流程/公开授权与k-匿名对比/AI 占位报告
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';
const ADMIN_CODE = process.env.ADMIN_CODE || 'dev-admin'; // 需与服务端 ADMIN_CODES 一致

const call = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

let pass = 0;
let fail = 0;
const check = (cond, name, detail) => {
  if (cond) {
    pass++;
    console.log('  \u2713', name);
  } else {
    fail++;
    console.log('  \u2717 FAIL:', name, detail ?? '');
  }
};

const sum = (shares) => shares.reduce((a, s) => a + s.share_cents, 0);

// ============ 1. 基础：登录 / 建寝 / 权限 ============
console.log('\n[1] 基础流程');
const head = await call('/auth/login', { method: 'POST', body: { code: 'head', nickname: '宿舍长' } });
check(head.status === 200 && head.body.token, '登录返回 token');
const T = head.body.token;

const dorm = await call('/dorms', { method: 'POST', token: T, body: { name: '1号楼404', gender: 'male' } });
check(dorm.status === 201, '创建寝室');
const dormId = dorm.body.dorm.id;
const headMemberId = dorm.body.members[0].id;
check(dorm.body.members[0].role === 'dorm_head', '创建者自动成为宿舍长');

const cats = await call(`/dorms/${dormId}/categories`, { token: T });
check(
  cats.body.categories.some((c) => c.name === '电费') && cats.body.categories.some((c) => c.name === '水费'),
  '预置电费/水费类别'
);

const mate1 = await call('/auth/login', { method: 'POST', body: { code: 'mate1', nickname: '室友A' } });
const mate2 = await call('/auth/login', { method: 'POST', body: { code: 'mate2', nickname: '室友B' } });
const mA = await call(`/dorms/${dormId}/members`, {
  method: 'POST', token: T, body: { userId: mate1.body.user.id, canInput: 1 },
});
const mB = await call(`/dorms/${dormId}/members`, {
  method: 'POST', token: T, body: { userId: mate2.body.user.id, canInput: 0 },
});
check(mA.status === 201 && mB.status === 201, '加入两名室友（B 无录入权限）');
const idA = mA.body.member.id;
const idB = mB.body.member.id;

// ============ 2. 分摊算法 ============
console.log('\n[2] 分摊算法');
const participants = [{ memberId: headMemberId }, { memberId: idA }, { memberId: idB }];
const eq = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: T,
  body: { title: '电费', amountCents: 10000, payerMemberId: headMemberId, splitMode: 'equal', participants, occurredOn: '2026-10-05' },
});
check(eq.status === 201 && sum(eq.body.expense.shares) === 10000, '均摊 ¥100 ÷ 3 人：合计恰为 10000 分',
  JSON.stringify(eq.body.expense?.shares));

const ratio = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: T,
  body: {
    title: '电费-按功率', amountYuan: 200, payerMemberId: headMemberId, splitMode: 'ratio', occurredOn: '2026-10-05',
    participants: [
      { memberId: headMemberId, weight: 3 },
      { memberId: idA, weight: 1 },
      { memberId: idB, weight: 1 },
    ],
  },
});
const headShare = ratio.body.expense?.shares.find((s) => s.dorm_member_id === headMemberId)?.share_cents;
check(ratio.status === 201 && sum(ratio.body.expense.shares) === 20000 && headShare === 12000,
  '按比例 3:1:1：权重 3 者承担 60%', JSON.stringify(ratio.body.expense?.shares));

const bad = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: T,
  body: { title: '乱填', amountCents: 100, splitMode: 'designated',
    participants: [{ memberId: headMemberId, cents: 30 }, { memberId: idA, cents: 50 }] },
});
check(bad.status === 400, '指定金额合计不符 → 400', JSON.stringify(bad.body));

// ============ 3. 排班轮换 ============
console.log('\n[3] 排班轮换');
const chore = await call(`/dorms/${dormId}/chores`, {
  method: 'POST', token: T,
  body: {
    name: '倒垃圾', cycle: 'weekly', baseDate: '2026-10-05',
    rotationMembers: [headMemberId, idA, idB],
    generate: { fromDate: '2026-10-05', toDate: '2026-10-26' },
  },
});
const seq = chore.body.assignments?.map((a) => a.memberId) || [];
check(chore.status === 201 && seq.length === 4 && seq[0] === headMemberId && seq[3] === headMemberId,
  '周排班 4 期且轮换回环', JSON.stringify(seq));

// ============ 4. 权限边界 ============
console.log('\n[4] 权限边界');
const denied = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: mate2.body.token, body: { title: '偷偷记', amountCents: 500 },
});
check(denied.status === 403, '无录入权限室友记账 → 403', JSON.stringify(denied.body));
check((await call(`/dorms/${dormId}/members`)).status === 401, '未登录访问 → 401');

// ============ 5. 反馈渠道 ============
console.log('\n[5] 反馈渠道');
const fb = await call('/feedback', {
  method: 'POST', token: T,
  body: { dormId, category: 'feature', content: '希望能加月度水电提醒', rating: 5 },
});
check(fb.status === 201 && fb.body.feedback.status === 'open', '提交需求反馈 → open');

const fbBadCat = await call('/feedback', {
  method: 'POST', token: T, body: { content: 'x', category: 'nope' },
});
check(fbBadCat.status === 400, '非法 category → 400', JSON.stringify(fbBadCat.body));

const fbBadRating = await call('/feedback', {
  method: 'POST', token: T, body: { content: 'x', rating: 9 },
});
check(fbBadRating.status === 400, '非法 rating → 400', JSON.stringify(fbBadRating.body));

const otherDorm = await call('/auth/login', { method: 'POST', body: { code: 'stranger', nickname: '外人' } });
const fbCross = await call('/feedback', {
  method: 'POST', token: otherDorm.body.token, body: { dormId, content: '冒名关联他人寝室' },
});
check(fbCross.status === 403, '为他人寝室关联反馈 → 403', JSON.stringify(fbCross.body));

const dormFb = await call(`/dorms/${dormId}/feedback`, { token: mate1.body.token });
check(dormFb.status === 200 && dormFb.body.feedback.some((f) => f.id === fb.body.feedback.id),
  '本寝成员可查看该寝反馈');

const admin = await call('/auth/login', { method: 'POST', body: { code: ADMIN_CODE, nickname: '开发组' } });
check(admin.status === 200 && admin.body.user.is_admin === 1, '白名单 code 登录获得 is_admin',
  JSON.stringify(admin.body.user));

const notAdmin = await call('/admin/feedback', { token: T });
check(notAdmin.status === 403, '非管理员访问后台反馈 → 403', JSON.stringify(notAdmin.body));

const adminList = await call('/admin/feedback', { token: admin.body.token });
check(adminList.status === 200 && adminList.body.feedback.length >= 1, '管理员查看全部反馈');

const patched = await call(`/admin/feedback/${fb.body.feedback.id}`, {
  method: 'PATCH', token: admin.body.token, body: { status: 'planned', reply: '已列入下期需求' },
});
check(patched.status === 200 && patched.body.feedback.status === 'planned' &&
  patched.body.feedback.handled_by === admin.body.user.id, '管理员改状态并回复');

const summary = await call('/admin/feedback/summary', { token: admin.body.token });
check(summary.status === 200 && summary.body.summary.totals.total >= 1 &&
  summary.body.summary.totals.adopted >= 1, '测评汇总可统计总数与采纳数',
  JSON.stringify(summary.body.summary?.totals));

// ============ 6. 公开授权与匿名对比 ============
console.log('\n[6] 公开授权与匿名对比');
const consentByMate = await call(`/dorms/${dormId}/consent`, {
  method: 'PUT', token: mate1.body.token, body: { reportConsent: true },
});
check(consentByMate.status === 403, '非宿舍长开关授权 → 403', JSON.stringify(consentByMate.body));

const consentBad = await call(`/dorms/${dormId}/consent`, {
  method: 'PUT', token: T, body: { reportConsent: 'yes' },
});
check(consentBad.status === 400, '授权开关需布尔值 → 400');

const consent = await call(`/dorms/${dormId}/consent`, {
  method: 'PUT', token: T, body: { reportConsent: true },
});
check(consent.status === 200 && consent.body.reportConsent === true, '宿舍长开启公开授权');

// 造另外两个已授权寝室，凑足 k-匿名样本
async function seedDorm(code, name, amountCents) {
  const u = await call('/auth/login', { method: 'POST', body: { code, nickname: name } });
  const d = await call('/dorms', { method: 'POST', token: u.body.token, body: { name, gender: 'female' } });
  const did = d.body.dorm.id;
  const mid = d.body.members[0].id;
  await call(`/dorms/${did}/expenses`, {
    method: 'POST', token: u.body.token,
    body: { title: '电费', amountCents, payerMemberId: mid, splitMode: 'equal', occurredOn: '2026-10-05' },
  });
  await call(`/dorms/${did}/consent`, { method: 'PUT', token: u.body.token, body: { reportConsent: true } });
  return did;
}

const under = await call('/stats/compare', { token: T });
check(under.status === 409,
  '授权样本不足 3 个 → 拒绝公开对比', JSON.stringify(under.body));

await seedDorm('dormB', '2号楼301', 15000);
await seedDorm('dormC', '3号楼502', 9000);

const cmp = await call('/stats/compare?month=2026-10', { token: T });
check(cmp.status === 200 && cmp.body.consentedDormCount >= 3, '样本足够后返回匿名对比');
check(Array.isArray(cmp.body.items) && cmp.body.items.every((i) => !('name' in i) && !('dorm_id' in i)),
  '对比结果不含寝室名与真实 id（仅别名）', JSON.stringify(cmp.body.items?.[0]));
check(!JSON.stringify(cmp.body).includes('1号楼404'), '防泄露：响应体搜不到寝室真名');
check(cmp.body.byGender.some((g) => g.gender === 'male' && g.dormCount >= 1) &&
  cmp.body.byGender.some((g) => g.gender === 'female'), '支持男/女生寝分组均值');

// 未授权寝室不出现在对比中
const outsider = await call('/auth/login', { method: 'POST', body: { code: 'out', nickname: '未授权组' } });
const od = await call('/dorms', { method: 'POST', token: outsider.body.token, body: { name: '未授权寝', gender: 'mixed' } });
await call(`/dorms/${od.body.dorm.id}/expenses`, {
  method: 'POST', token: outsider.body.token,
  body: { title: '电费', amountCents: 888888, payerMemberId: od.body.members[0].id, splitMode: 'equal', occurredOn: '2026-10-05' },
});
const cmp2 = await call('/stats/compare?month=2026-10', { token: T });
check(!JSON.stringify(cmp2.body.items).includes('888888'), '未授权寝室的金额不进入公开对比');

const bench = await call(`/dorms/${dormId}/stats/benchmark?month=2026-10`, { token: T });
check(bench.status === 200 && bench.body.benchmark.self.perCapitaCents === 10000 &&
  bench.body.benchmark.rank && Number.isInteger(bench.body.benchmark.deltaPercent),
  '本寝对标：人均/名次/偏差', JSON.stringify(bench.body.benchmark?.self));

const revoke = await call(`/dorms/${dormId}/consent`, {
  method: 'PUT', token: T, body: { reportConsent: false },
});
check(revoke.status === 200 && revoke.body.reportConsent === false, '宿舍长可撤回授权');
const cmp3 = await call('/stats/compare?month=2026-10', { token: T });
check(cmp3.status !== 200 || !JSON.stringify(cmp3.body.items).includes('10000'),
  '撤回后该寝数据从对比池移除', JSON.stringify(cmp3.body.items));
// 复原，供 AI 报告使用
await call(`/dorms/${dormId}/consent`, { method: 'PUT', token: T, body: { reportConsent: true } });

// ============ 7. AI 占位接口 ============
console.log('\n[7] AI 月报（占位）');
const prov = await call('/ai/provider', { token: T });
check(prov.status === 200 && prov.body.provider === 'placeholder', 'AI provider 默认离线占位');

const report = await call(`/dorms/${dormId}/ai/report?month=2026-10`, { token: T });
const rep = report.body.report || '';
check(report.status === 200 && rep.includes('月报') && report.body.prompt.length > 0,
  '生成月报且带可复用的 prompt');
check(rep.includes('¥300.00'), '报告数字来自真实账目（100+200 元）', rep.slice(0, 120));
check(rep.includes('占位') || rep.includes('未调用外部'), '报告显式声明未调用外部模型');

const anonReport = await call(`/dorms/${od.body.dorm.id}/ai/report`, { token: T });
check(anonReport.status === 403, '非本寝成员请求 AI 报告 → 403');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
