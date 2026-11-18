var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    month: '', monthCN: '', total: '0.00', count: 0, avg: '0.00',
    cats: [], members: [], days: [], maxDay: 1,
    consent: false, isHead: false, cmp: null, cmpErr: '', myAlias: '', dorm: null
  },
  onShow: function () {
    S.init();
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    var dorm = S.myDorm();
    if (!dorm) { wx.showToast({ title: '请先加入寝室', icon: 'none' }); setTimeout(function () { wx.navigateBack(); }, 900); return; }
    if (!this.data.month) this.setData({ month: F.monthKey(F.today()) });
    this.setData({ dorm: dorm, isHead: S.isHead(), consent: dorm.consent });
    this.refresh();
  },
  refresh: function () {
    var d = this.data;
    var st = S.stats(d.dorm.id, d.month);
    var maxCat = st.byCat.length ? st.byCat[0].cents : 1;
    var maxMem = st.byMember.length ? st.byMember[0].cents : 1;
    var cats = st.byCat.map(function (c) {
      return { name: c.name, hue: c.hue, str: F.yuan(c.cents), count: c.count, pct: Math.round(c.cents * 100 / maxCat), share: st.total ? Math.round(c.cents * 100 / st.total) : 0 };
    });
    var members = st.byMember.map(function (m) {
      return { name: m.name, hue: m.hue, str: F.yuan(m.cents), pct: Math.round(m.cents * 100 / maxMem) };
    });
    var keys = Object.keys(st.byDay).sort();
    var maxDay = 1;
    keys.forEach(function (k) { if (st.byDay[k] > maxDay) maxDay = st.byDay[k]; });
    var days = keys.map(function (k) {
      return { d: +k.slice(8), h: Math.max(6, Math.round(st.byDay[k] * 100 / maxDay)), str: F.yuan(st.byDay[k]) };
    });
    var cmp = S.anonCompare(d.month);
    var myAlias = '';
    if (cmp.ok) {
      cmp.rows.forEach(function (r) { if (r.dormId === d.dorm.id) myAlias = r.alias; });
      cmp.rows = cmp.rows.map(function (r, i) {
        return { alias: r.alias, per: F.yuan(r.per), total: F.yuan(r.total), members: r.members, rank: i + 1, mine: r.dormId === d.dorm.id };
      });
    }
    this.setData({
      monthCN: F.monthCN(d.month), total: F.yuan(st.total), count: st.count, avg: F.yuan(st.avg),
      cats: cats, members: members, days: days, maxDay: maxDay,
      cmp: cmp.ok ? cmp : null,
      cmpErr: cmp.ok ? '' : '已授权寝室 ' + cmp.have + ' 间，不足 k-匿名门槛 ' + cmp.need + ' 间，对比已隐藏',
      myAlias: myAlias
    });
  },
  onMonth: function (e) { this.setData({ month: e.detail.value.slice(0, 7) }); this.refresh(); },
  onConsent: function () {
    if (!this.data.isHead) { wx.showToast({ title: '仅寝室长可切换授权', icon: 'none' }); return; }
    var v = S.toggleConsent(this.data.dorm.id);
    this.setData({ consent: v });
    wx.showToast({ title: v ? '已授权加入匿名对比' : '已撤回授权', icon: 'none' });
    this.refresh();
  },
  goReport: function () { wx.navigateTo({ url: '/pages/report/report?month=' + this.data.month }); }
});