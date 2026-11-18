// ============================================================
// 本地种子账本数据层（离线可交互演示）
// 结构与 backend/ REST 接口对应：expenses / splits / settlements /
// duty / feedback / consent / admin。联调时替换为 wx.request 即可。
// 金额一律整数分；分摊用最大余额法，保证 sum(splits) === total。
// ============================================================
var F = require('./fmt.js');
var KEY = 'g18_ledger_v1';
var db = null;

var HUES = ['#0F3D33', '#D9482B', '#E8A33D', '#2E9E6B', '#2E77AE', '#7A4E8C', '#5B6B7A', '#C2703E'];

function nid(p) { db.seq += 1; return p + db.seq; }
function save() { try { wx.setStorageSync(KEY, JSON.stringify(db)); } catch (e) {} }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function seed() {
  var t = F.today();
  var d = function (n) { return F.addDays(t, -n); };
  db = {
    seq: 100,
    session: { userId: 'u1' },
    users: [
      { id: 'u1', name: '邹向惠', role: 'head', dormId: 'd1', hue: HUES[0], locked: false },
      { id: 'u2', name: '张子琪', role: 'member', dormId: 'd1', hue: HUES[4], locked: false },
      { id: 'u3', name: '孙敏超', role: 'member', dormId: 'd1', hue: HUES[2], locked: false },
      { id: 'u4', name: '陈屿', role: 'member', dormId: 'd1', hue: HUES[1], locked: false },
      { id: 'u5', name: '林晓', role: 'head', dormId: 'd2', hue: HUES[5], locked: false },
      { id: 'u6', name: '周桐', role: 'member', dormId: 'd2', hue: HUES[3], locked: false },
      { id: 'u7', name: '苏梨', role: 'head', dormId: 'd3', hue: HUES[7], locked: false },
      { id: 'u8', name: '何静', role: 'member', dormId: 'd3', hue: HUES[6], locked: false },
      { id: 'u9', name: '系统管理员', role: 'admin', dormId: null, hue: HUES[5], locked: false }
    ],
    dorms: [
      { id: 'd1', name: '梧桐苑 3栋502', code: '502502', headId: 'u1', memberIds: ['u1', 'u2', 'u3', 'u4'], dutyOrder: ['u2', 'u3', 'u4', 'u1'], consent: true, rules: ['值日当日 22:00 前完成打卡', '公共支出单笔超过 50 元需寝室长确认', '每月 1 号结清上月账单', '饮用水与电费按人均摊，零食自愿参与'] },
      { id: 'd2', name: '梧桐苑 4栋311', code: '311311', headId: 'u5', memberIds: ['u5', 'u6'], dutyOrder: ['u5', 'u6'], consent: true, rules: ['电费按人均摊'] },
      { id: 'd3', name: '竹韵苑 7栋208', code: '208208', headId: 'u7', memberIds: ['u7', 'u8'], dutyOrder: ['u7', 'u8'], consent: true, rules: ['每周日大扫除'] }
    ],
    categories: [
      { id: 'c1', dormId: 'd1', name: '饮用水', hue: '#2E77AE' },
      { id: 'c2', dormId: 'd1', name: '电费', hue: '#E8A33D' },
      { id: 'c3', dormId: 'd1', name: '网费', hue: '#7A4E8C' },
      { id: 'c4', dormId: 'd1', name: '清洁用品', hue: '#2E9E6B' },
      { id: 'c5', dormId: 'd1', name: '公共零食', hue: '#D9482B' },
      { id: 'c6', dormId: 'd1', name: '打印费', hue: '#5B6B7A' },
      { id: 'c7', dormId: 'd2', name: '电费', hue: '#E8A33D' },
      { id: 'c8', dormId: 'd2', name: '饮用水', hue: '#2E77AE' },
      { id: 'c9', dormId: 'd3', name: '清洁用品', hue: '#2E9E6B' }
    ],
    bills: [],
    settlements: [],
    duty: [],
    feedback: [
      { id: 'f1', userId: 'u2', dormId: 'd1', type: 'suggestion', content: '希望账单可以按周查看，方便周末对账。', status: 'adopted', reply: '已采纳：账单页新增日/周/月三种周期。', createdAt: Date.now() - 86400000 * 6 },
      { id: 'f2', userId: 'u4', dormId: 'd1', type: 'complaint', content: '有人连续两次值日不打卡，希望寝室长跟进提醒。', status: 'pending', reply: '', createdAt: Date.now() - 86400000 * 2 },
      { id: 'f3', userId: 'u3', dormId: 'd1', type: 'dispute', content: '上周零食分摊比例有争议，申请管理员调解。', status: 'pending', reply: '', createdAt: Date.now() - 86400000 * 1 }
    ],
    flags: [
      { id: 'g1', userId: 'u4', dormId: 'd1', text: '（示例）含不当言论的留言内容……', reason: '被成员举报：言语不当', status: 'pending' },
      { id: 'g2', userId: 'u6', dormId: 'd2', text: '（示例）广告刷屏内容……', reason: '系统识别：疑似广告', status: 'removed' }
    ]
  };

  function bill(days, title, cents, cat, payer, parts, mode, ratios, settled, note) {
    var weights = parts.map(function (_, i) {
      if (mode === 'ratio') return ratios[i];
      return 1;
    });
    var splits;
    if (mode === 'custom') {
      splits = parts.map(function (m, i) { return { memberId: m, cents: ratios[i] }; });
    } else {
      splits = splitCents(cents, weights).map(function (c, i) { return { memberId: parts[i], cents: c }; });
    }
    db.bills.push({
      id: nid('b'), dormId: 'd1', title: title, amountCents: cents, categoryId: cat,
      payerId: payer, participantIds: parts, splitMode: mode, splits: splits,
      occurredOn: d(days), note: note || '', createdAt: Date.now() - days * 86400000, settled: !!settled
    });
  }
  var ALL = ['u1', 'u2', 'u3', 'u4'];
  bill(38, '桶装水 ×2', 3000, 'c1', 'u1', ALL, 'equal', null, true);
  bill(35, '10月电费', 12860, 'c2', 'u2', ALL, 'equal', null, true);
  bill(33, '宽带月费', 6000, 'c3', 'u1', ALL, 'equal', null, true);
  bill(30, '洗衣液+垃圾袋', 4580, 'c4', 'u3', ALL, 'equal', null, true);
  bill(26, '期中复习打印', 2350, 'c6', 'u2', ['u2', 'u3'], 'equal', null, true);
  bill(22, '公共零食大礼包', 8990, 'c5', 'u4', ['u1', 'u2', 'u4'], 'ratio', [2, 1, 2], true, '敏超不吃零食，未参与');
  bill(18, '桶装水 ×2', 3000, 'c1', 'u3', ALL, 'equal', null, true);
  bill(12, '11月电费', 14240, 'c2', 'u1', ALL, 'equal', null, false);
  bill(9, '宽带月费', 6000, 'c3', 'u2', ALL, 'equal', null, false);
  bill(6, '洁厕灵+抹布', 2680, 'c4', 'u4', ALL, 'equal', null, false);
  bill(4, '夜宵拼单', 5630, 'c5', 'u1', ['u1', 'u3', 'u4'], 'custom', [2000, 1800, 1830], false, '按各自点的金额');
  bill(2, '桶装水 ×1', 1500, 'c1', 'u2', ALL, 'equal', null, false);
  bill(1, '实验报告打印', 1240, 'c6', 'u3', ['u1', 'u3'], 'ratio', [1, 3], false);
  bill(0, '洗手液补充装', 1990, 'c4', 'u1', ALL, 'equal', null, false);

  // 其他寝室账单（供管理员统计与匿名对比）
  db.bills.push({ id: nid('b'), dormId: 'd2', title: '11月电费', amountCents: 9800, categoryId: 'c7', payerId: 'u5', participantIds: ['u5', 'u6'], splitMode: 'equal', splits: [{ memberId: 'u5', cents: 4900 }, { memberId: 'u6', cents: 4900 }], occurredOn: d(8), note: '', createdAt: Date.now() - 8 * 86400000, settled: false });
  db.bills.push({ id: nid('b'), dormId: 'd2', title: '桶装水', amountCents: 3000, categoryId: 'c8', payerId: 'u6', participantIds: ['u5', 'u6'], splitMode: 'equal', splits: [{ memberId: 'u5', cents: 1500 }, { memberId: 'u6', cents: 1500 }], occurredOn: d(3), note: '', createdAt: Date.now() - 3 * 86400000, settled: false });
  db.bills.push({ id: nid('b'), dormId: 'd3', title: '大扫除工具', amountCents: 7600, categoryId: 'c9', payerId: 'u7', participantIds: ['u7', 'u8'], splitMode: 'equal', splits: [{ memberId: 'u7', cents: 3800 }, { memberId: 'u8', cents: 3800 }], occurredOn: d(5), note: '', createdAt: Date.now() - 5 * 86400000, settled: false });

  // 值日：过去 6 天 + 今天 + 未来 6 天，取模轮转（锚点保证种子区与后续自动排班相位连续）
  db.dutyAnchor = t;
  var order = db.dorms[0].dutyOrder;
  for (var i = -6; i <= 6; i++) {
    var date = F.addDays(t, i);
    var idx = ((i % order.length) + order.length) % order.length;
    var mid = order[idx];
    var done = i < 0 ? (i !== -3) : false; // -3 那天漏打卡，用于展示缺卡
    db.duty.push({ id: nid('y'), dormId: 'd1', date: date, memberId: mid, done: done, doneAt: done ? Date.now() + i * 86400000 : null, swap: null });
  }
  save();
}

function init() {
  if (db) return db;
  try {
    var raw = wx.getStorageSync(KEY);
    if (raw) db = JSON.parse(raw);
  } catch (e) { db = null; }
  if (!db || !db.users) seed();
  if (!db.dutyAnchor) {
    // 旧版本地账本无锚点：用首条值日记录反推，保证轮转相位不跳变
    var y0 = db.duty && db.duty[0];
    var d0 = y0 && dormById(y0.dormId);
    var i0 = d0 ? d0.dutyOrder.indexOf(y0.memberId) : -1;
    db.dutyAnchor = (y0 && i0 >= 0) ? F.addDays(y0.date, -i0) : F.today();
  }
  return db;
}
function reset() { db = null; try { wx.removeStorageSync(KEY); } catch (e) {} seed(); }

// ---------- 基础查询 ----------
function me() { init(); return userById(db.session && db.session.userId); }
function userById(id) { for (var i = 0; i < db.users.length; i++) if (db.users[i].id === id) return db.users[i]; return null; }
function dormById(id) { for (var i = 0; i < db.dorms.length; i++) if (db.dorms[i].id === id) return db.dorms[i]; return null; }
function catById(id) { for (var i = 0; i < db.categories.length; i++) if (db.categories[i].id === id) return db.categories[i]; return null; }
function myDorm() { var m = me(); return m && m.dormId ? dormById(m.dormId) : null; }
function members(dormId) {
  var d = dormById(dormId); if (!d) return [];
  return d.memberIds.map(userById).filter(Boolean);
}
function cats(dormId) { return db.categories.filter(function (c) { return c.dormId === dormId; }); }
function billsOf(dormId) {
  return db.bills.filter(function (b) { return b.dormId === dormId; })
    .sort(function (a, b) { return a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : b.createdAt - a.createdAt; });
}
function isHead() { var m = me(); var d = myDorm(); return !!(m && d && d.headId === m.id); }
function isAdmin() { var m = me(); return !!(m && m.role === 'admin'); }
function roleCN(r) { return r === 'head' ? '寝室长' : r === 'admin' ? '管理员' : '普通成员'; }

// ---------- 会话 ----------
function login(userId) { init(); db.session = { userId: userId }; save(); }
function logout() { init(); db.session = null; save(); }

// ---------- 分摊引擎（整数分 · 最大余额法） ----------
function splitCents(total, weights) {
  var sum = 0, i;
  for (i = 0; i < weights.length; i++) sum += weights[i];
  if (sum <= 0) return weights.map(function () { return 0; });
  var base = [], rem = [], out = [], assigned = 0;
  for (i = 0; i < weights.length; i++) {
    var exact = total * weights[i] / sum;
    var fl = Math.floor(exact);
    base.push(fl); assigned += fl;
    rem.push({ i: i, frac: exact - fl });
  }
  rem.sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
  var left = total - assigned;
  for (i = 0; i < left; i++) base[rem[i % rem.length].i] += 1;
  for (i = 0; i < base.length; i++) out.push(base[i]);
  return out;
}
function computeSplits(total, parts, mode, ratios) {
  if (mode === 'custom') {
    return parts.map(function (m, i) { return { memberId: m, cents: Math.round(ratios[i] || 0) }; });
  }
  var weights = parts.map(function (_, i) { return mode === 'ratio' ? Math.max(0, +ratios[i] || 0) : 1; });
  return splitCents(total, weights).map(function (c, i) { return { memberId: parts[i], cents: c }; });
}
function addBill(draft) {
  init();
  var splits = computeSplits(draft.amountCents, draft.participantIds, draft.splitMode, draft.ratios);
  var sum = splits.reduce(function (s, x) { return s + x.cents; }, 0);
  if (sum !== draft.amountCents) return { ok: false, msg: '分摊合计与总额不一致（守恒校验失败）' };
  var b = {
    id: nid('b'), dormId: draft.dormId, title: draft.title, amountCents: draft.amountCents,
    categoryId: draft.categoryId, payerId: draft.payerId, participantIds: draft.participantIds,
    splitMode: draft.splitMode, splits: splits, occurredOn: draft.occurredOn,
    note: draft.note || '', createdAt: Date.now(), settled: false
  };
  db.bills.push(b); save();
  return { ok: true, bill: b };
}
function deleteBill(id) {
  init();
  var idx = -1;
  for (var i = 0; i < db.bills.length; i++) if (db.bills[i].id === id) idx = i;
  if (idx < 0) return null;
  var removed = db.bills.splice(idx, 1)[0]; save();
  return function undo() { db.bills.splice(Math.min(idx, db.bills.length), 0, removed); save(); };
}

// ---------- 净额结算（贪心最小转账） ----------
// 口径：仅未结清账单产生净额；结算记录为历史凭证（结清时账单已整体出池），
// 不再重复计入，避免双重记账。
function balances(dormId) {
  var map = {};
  members(dormId).forEach(function (m) { map[m.id] = 0; });
  db.bills.forEach(function (b) {
    if (b.dormId !== dormId || b.settled) return;
    map[b.payerId] = (map[b.payerId] || 0) + b.amountCents;
    b.splits.forEach(function (s) { map[s.memberId] = (map[s.memberId] || 0) - s.cents; });
  });
  return map;
}
function transfers(dormId) {
  var map = balances(dormId);
  var debt = [], cred = [];
  Object.keys(map).forEach(function (id) {
    if (map[id] < -0) debt.push({ id: id, cents: -map[id] });
    else if (map[id] > 0) cred.push({ id: id, cents: map[id] });
  });
  debt.sort(function (a, b) { return b.cents - a.cents; });
  cred.sort(function (a, b) { return b.cents - a.cents; });
  var out = [], i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    var pay = Math.min(debt[i].cents, cred[j].cents);
    if (pay > 0) out.push({ from: debt[i].id, to: cred[j].id, cents: pay });
    debt[i].cents -= pay; cred[j].cents -= pay;
    if (debt[i].cents === 0) i++;
    if (cred[j].cents === 0) j++;
  }
  return out;
}
function settleAll(dormId) {
  init();
  var tr = transfers(dormId);
  if (!tr.length) return { ok: false, msg: '当前没有待结清的差额' };
  db.settlements.push({ id: nid('s'), dormId: dormId, transfers: tr, createdAt: Date.now() });
  db.bills.forEach(function (b) { if (b.dormId === dormId) b.settled = true; });
  save();
  return { ok: true, transfers: tr };
}

// ---------- 值日排班（取模轮转） ----------
function dayMs(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
function dutyIdx(date, len, anchor) {
  var days = Math.round((dayMs(date) - dayMs(anchor)) / 86400000);
  return ((days % len) + len) % len;
}
function ensureDuty(dormId, from, to) {
  var d = dormById(dormId); if (!d || !d.dutyOrder.length) return;
  var anchor = db.dutyAnchor || F.today();
  var cur = from, added = false;
  while (cur <= to) {
    var exists = db.duty.some(function (y) { return y.dormId === dormId && y.date === cur; });
    if (!exists) {
      var mid = d.dutyOrder[dutyIdx(cur, d.dutyOrder.length, anchor)];
      db.duty.push({ id: nid('y'), dormId: dormId, date: cur, memberId: mid, done: false, doneAt: null, swap: null });
      added = true;
    }
    cur = F.addDays(cur, 1);
  }
  if (added) save(); // 无新增不落盘，避免每次刷新都序列化整库
}
function dutyRange(dormId, from, to) {
  init(); ensureDuty(dormId, from, to);
  return db.duty.filter(function (y) { return y.dormId === dormId && y.date >= from && y.date <= to; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}
function checkin(dutyId) {
  init();
  for (var i = 0; i < db.duty.length; i++) if (db.duty[i].id === dutyId) {
    db.duty[i].done = true; db.duty[i].doneAt = Date.now(); save(); return db.duty[i];
  }
  return null;
}
function requestSwap(dutyId, toId) {
  init();
  for (var i = 0; i < db.duty.length; i++) if (db.duty[i].id === dutyId) {
    db.duty[i].swap = { to: toId, status: 'pending', by: db.session.userId }; save(); return db.duty[i];
  }
  return null;
}
function respondSwap(dutyId, accept) {
  init();
  for (var i = 0; i < db.duty.length; i++) if (db.duty[i].id === dutyId) {
    var y = db.duty[i];
    if (!y.swap || y.swap.status !== 'pending') return null;
    y.swap.status = accept ? 'accepted' : 'rejected';
    if (accept) { y.memberId = y.swap.to; y.done = false; y.doneAt = null; }
    save(); return y;
  }
  return null;
}

// ---------- 统计 / 匿名对比 / 月报 ----------
function stats(dormId, month) {
  var list = billsOf(dormId).filter(function (b) { return F.monthKey(b.occurredOn) === month; });
  var total = 0, byCat = {}, byMember = {}, byDay = {};
  list.forEach(function (b) {
    total += b.amountCents;
    var c = catById(b.categoryId);
    var ck = c ? c.name : '其他';
    if (!byCat[ck]) byCat[ck] = { name: ck, hue: c ? c.hue : '#5B6B7A', cents: 0, count: 0 };
    byCat[ck].cents += b.amountCents; byCat[ck].count += 1;
    b.splits.forEach(function (s) {
      var u = userById(s.memberId);
      var mk = u ? u.name : '?';
      if (!byMember[mk]) byMember[mk] = { name: mk, hue: u ? u.hue : '#5B6B7A', cents: 0 };
      byMember[mk].cents += s.cents;
    });
    byDay[b.occurredOn] = (byDay[b.occurredOn] || 0) + b.amountCents;
  });
  var n = members(dormId).length || 1;
  return {
    month: month, count: list.length, total: total, avg: Math.round(total / n),
    byCat: Object.keys(byCat).map(function (k) { return byCat[k]; }).sort(function (a, b) { return b.cents - a.cents; }),
    byMember: Object.keys(byMember).map(function (k) { return byMember[k]; }).sort(function (a, b) { return b.cents - a.cents; }),
    byDay: byDay, bills: list
  };
}
function anonCompare(month) {
  init();
  var pool = db.dorms.filter(function (d) { return d.consent; });
  if (pool.length < 3) return { ok: false, have: pool.length, need: 3 };
  var rows = pool.map(function (d) {
    var s = stats(d.id, month);
    var n = d.memberIds.length || 1;
    return { alias: '寝室#' + d.id.slice(-2) + '***', dormId: d.id, total: s.total, per: Math.round(s.total / n), members: n };
  }).sort(function (a, b) { return b.per - a.per; });
  return { ok: true, rows: rows, pool: pool.length };
}
function report(month) {
  var d = myDorm(); if (!d) return '';
  var s = stats(d.id, month);
  var top = s.byCat[0];
  var duty = dutyRange(d.id, month + '-01', F.addDays(month + '-01', 30));
  var doneN = duty.filter(function (y) { return y.done; }).length;
  var past = duty.filter(function (y) { return y.date <= F.today(); }).length;
  var lines = [];
  lines.push('【' + F.monthCN(month) + ' · ' + d.name + ' 公共费用月报】');
  lines.push('本月共登记 ' + s.count + ' 笔公共支出，合计 ' + F.yuanStr(s.total) + '，人均 ' + F.yuanStr(s.avg) + '。');
  if (top) lines.push('支出最高的类别是「' + top.name + '」，共 ' + F.yuanStr(top.cents) + '（' + top.count + ' 笔），占 ' + Math.round(top.cents * 100 / (s.total || 1)) + '%。');
  if (s.byMember[0]) lines.push('分摊最多的是 ' + s.byMember[0].name + '（' + F.yuanStr(s.byMember[0].cents) + '），建议核对是否有垫付未结清。');
  lines.push('值日打卡 ' + doneN + '/' + past + ' 次' + (doneN < past ? '，存在缺卡，记得补卡或发起换班。' : '，全员全勤，继续保持！'));
  lines.push('小贴士：电费与饮用水为固定支出，可提前预存；零食类建议沿用自愿参与的比例分摊。');
  lines.push('—— 本报告由离线模板生成（AI 接口占位，未调用外部服务）');
  return lines.join('\n');
}

// ---------- 反馈 / 授权 / 内容 ----------
function addFeedback(type, content) {
  init();
  var m = me();
  var f = { id: nid('f'), userId: m.id, dormId: m.dormId, type: type, content: content, status: 'pending', reply: '', createdAt: Date.now() };
  db.feedback.unshift(f); save(); return f;
}
function triageFeedback(id, status, reply) {
  init();
  for (var i = 0; i < db.feedback.length; i++) if (db.feedback[i].id === id) {
    db.feedback[i].status = status; db.feedback[i].reply = reply || ''; save(); return db.feedback[i];
  }
  return null;
}
function toggleConsent(dormId) {
  init();
  var d = dormById(dormId); if (!d) return null;
  d.consent = !d.consent; save(); return d.consent;
}
function resolveFlag(id, action) {
  init();
  for (var i = 0; i < db.flags.length; i++) if (db.flags[i].id === id) {
    db.flags[i].status = action; save(); return db.flags[i];
  }
  return null;
}

// ---------- 寝室管理 ----------
function createDorm(name) {
  init();
  var m = me();
  if (m.dormId) return { ok: false, msg: '你已在寝室中，请先退出当前寝室' };
  var d = { id: nid('d'), name: name, code: String(100000 + Math.floor(Math.random() * 899999)), headId: m.id, memberIds: [m.id], dutyOrder: [m.id], consent: false, rules: ['值日当日 22:00 前完成打卡', '每月 1 号结清上月账单'] };
  db.dorms.push(d);
  m.role = 'head'; m.dormId = d.id;
  ['饮用水', '电费', '清洁用品', '公共零食'].forEach(function (n, i) {
    db.categories.push({ id: nid('c'), dormId: d.id, name: n, hue: HUES[(i + 3) % HUES.length] });
  });
  save(); return { ok: true, dorm: d };
}
function joinByCode(code) {
  init();
  var m = me();
  var d = null;
  db.dorms.forEach(function (x) { if (x.code === code) d = x; });
  if (!d) return { ok: false, msg: '邀请码不存在，请核对后重试' };
  if (m.dormId === d.id) return { ok: false, msg: '你已经是该寝室成员' };
  if (m.dormId) {
    var old = dormById(m.dormId);
    if (old && old.headId === m.id) return { ok: false, msg: '寝室长需先转让管理权才能退出' };
    old.memberIds = old.memberIds.filter(function (x) { return x !== m.id; });
    old.dutyOrder = old.dutyOrder.filter(function (x) { return x !== m.id; });
  }
  d.memberIds.push(m.id); d.dutyOrder.push(m.id);
  m.dormId = d.id; m.role = 'member';
  save(); return { ok: true, dorm: d };
}
function leaveDorm() {
  init();
  var m = me(); var d = myDorm();
  if (!d) return { ok: false, msg: '你当前不在任何寝室' };
  if (d.headId === m.id) return { ok: false, msg: '寝室长需先转让管理权才能退出' };
  d.memberIds = d.memberIds.filter(function (x) { return x !== m.id; });
  d.dutyOrder = d.dutyOrder.filter(function (x) { return x !== m.id; });
  m.dormId = null; m.role = 'member'; save();
  return { ok: true };
}
function removeMember(dormId, userId) {
  init();
  var d = dormById(dormId); if (!d) return null;
  var idx = d.memberIds.indexOf(userId);
  if (idx < 0 || userId === d.headId) return null;
  d.memberIds.splice(idx, 1);
  d.dutyOrder = d.dutyOrder.filter(function (x) { return x !== userId; });
  var u = userById(userId); if (u) { u.dormId = null; u.role = 'member'; }
  save();
  return function undo() {
    d.memberIds.splice(Math.min(idx, d.memberIds.length), 0, userId);
    if (d.dutyOrder.indexOf(userId) < 0) d.dutyOrder.push(userId);
    if (u) { u.dormId = d.id; }
    save();
  };
}
function updateRules(dormId, rules) { init(); var d = dormById(dormId); if (d) { d.rules = rules; save(); } return d; }
function reorderDuty(dormId, userId, dir) {
  init();
  var d = dormById(dormId); if (!d) return;
  var i = d.dutyOrder.indexOf(userId); var j = i + dir;
  if (i < 0 || j < 0 || j >= d.dutyOrder.length) return;
  var tmp = d.dutyOrder[i]; d.dutyOrder[i] = d.dutyOrder[j]; d.dutyOrder[j] = tmp;
  save();
}
function addCategory(dormId, name) {
  init();
  var c = { id: nid('c'), dormId: dormId, name: name, hue: HUES[db.categories.length % HUES.length] };
  db.categories.push(c); save(); return c;
}

// ---------- 管理员 ----------
function adminStats() {
  init();
  var total = 0;
  db.bills.forEach(function (b) { total += b.amountCents; });
  return {
    dorms: db.dorms.length,
    users: db.users.filter(function (u) { return u.role !== 'admin'; }).length,
    bills: db.bills.length,
    total: total,
    pendingFb: db.feedback.filter(function (f) { return f.status === 'pending'; }).length,
    pendingFlag: db.flags.filter(function (f) { return f.status === 'pending'; }).length,
    locked: db.users.filter(function (u) { return u.locked; }).length
  };
}
function lockUser(id, locked) {
  init();
  var u = userById(id); if (!u) return null;
  u.locked = locked; save(); return u;
}
function updateDorm(id, name) { init(); var d = dormById(id); if (d) { d.name = name; save(); } return d; }
function deleteDorm(id) {
  init();
  var di = -1;
  db.dorms.forEach(function (d, i) { if (d.id === id) di = i; });
  if (di < 0) return null;
  var snapD = db.dorms[di];
  var snapB = db.bills.filter(function (b) { return b.dormId === id; });
  var snapY = db.duty.filter(function (y) { return y.dormId === id; });
  var snapC = db.categories.filter(function (c) { return c.dormId === id; });
  db.dorms.splice(di, 1);
  db.bills = db.bills.filter(function (b) { return b.dormId !== id; });
  db.duty = db.duty.filter(function (y) { return y.dormId !== id; });
  db.categories = db.categories.filter(function (c) { return c.dormId !== id; });
  snapD.memberIds.forEach(function (uid) { var u = userById(uid); if (u) { u.dormId = null; u.role = 'member'; } });
  save();
  return function undo() {
    db.dorms.splice(Math.min(di, db.dorms.length), 0, snapD);
    db.bills = db.bills.concat(snapB);
    db.duty = db.duty.concat(snapY);
    db.categories = db.categories.concat(snapC);
    snapD.memberIds.forEach(function (uid) { var u = userById(uid); if (u) { u.dormId = snapD.id; u.role = uid === snapD.headId ? 'head' : 'member'; } });
    save();
  };
}

module.exports = {
  init: init, reset: reset, save: save,
  me: me, myDorm: myDorm, userById: userById, dormById: dormById, catById: catById,
  members: members, cats: cats, billsOf: billsOf, isHead: isHead, isAdmin: isAdmin, roleCN: roleCN,
  login: login, logout: logout,
  splitCents: splitCents, computeSplits: computeSplits, addBill: addBill, deleteBill: deleteBill,
  balances: balances, transfers: transfers, settleAll: settleAll,
  dutyRange: dutyRange, checkin: checkin, requestSwap: requestSwap, respondSwap: respondSwap,
  stats: stats, anonCompare: anonCompare, report: report,
  addFeedback: addFeedback, triageFeedback: triageFeedback, toggleConsent: toggleConsent, resolveFlag: resolveFlag,
  createDorm: createDorm, joinByCode: joinByCode, leaveDorm: leaveDorm, removeMember: removeMember,
  updateRules: updateRules, reorderDuty: reorderDuty, addCategory: addCategory,
  adminStats: adminStats, lockUser: lockUser, updateDorm: updateDorm, deleteDorm: deleteDorm,
  allUsers: function () { init(); return db.users; },
  allDorms: function () { init(); return db.dorms; },
  allFeedback: function () { init(); return db.feedback; },
  allFlags: function () { init(); return db.flags; },
  allBills: function () { init(); return db.bills; },
  settlementsOf: function (dormId) {
    init();
    return db.settlements.filter(function (s) { return s.dormId === dormId; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
};