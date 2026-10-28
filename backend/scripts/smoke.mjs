// 冒烟测试：需先启动服务 (npm start)，再运行 node scripts/smoke.mjs
// 覆盖：登录/建寝/权限/预置类别/三种分摊/排班轮换，并断言分摊合计无误差。
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';

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

const participants = [
  { memberId: headMemberId },
  { memberId: idA },
  { memberId: idB },
];
const eq = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: T,
  body: { title: '电费', amountCents: 10000, payerMemberId: headMemberId, splitMode: 'equal', participants },
});
check(eq.status === 201 && sum(eq.body.expense.shares) === 10000, '均摊 ¥100 ÷ 3 人：合计恰为 10000 分',
  JSON.stringify(eq.body.expense?.shares));

const ratio = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: T,
  body: {
    title: '电费-按功率', amountYuan: 200, payerMemberId: headMemberId, splitMode: 'ratio',
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

const denied = await call(`/dorms/${dormId}/expenses`, {
  method: 'POST', token: mate2.body.token, body: { title: '偷偷记', amountCents: 500 },
});
check(denied.status === 403, '无录入权限室友记账 → 403', JSON.stringify(denied.body));

const anon = await call(`/dorms/${dormId}/members`);
check(anon.status === 401, '未登录访问 → 401');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
