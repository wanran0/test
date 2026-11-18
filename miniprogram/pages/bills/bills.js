var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    period: 'month', anchor: '', anchorCN: '', kw: '', catId: '', sort: 'time',
    cats: [], list: [], sum: '0.00', n: 0, dorm: null
  },
  onShow: function () {
    S.init();
    var tb = this.getTabBar && this.getTabBar();
    if (tb) tb.setData({ selected: 1 });
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    var dorm = S.myDorm();
    if (!this.data.anchor) this.setData({ anchor: F.today() });
    this.setData({ dorm: dorm, cats: dorm ? S.cats(dorm.id) : [] });
    this.refresh();
  },
  refresh: function () {
    var d = this.data;
    if (!d.dorm) { this.setData({ list: [], sum: '0.00', n: 0 }); return; }
    var from, to;
    if (d.period === 'day') { from = to = d.anchor; }
    else if (d.period === 'week') { from = F.weekStart(d.anchor); to = F.addDays(from, 6); }
    else { from = d.anchor.slice(0, 7) + '-01'; to = d.anchor.slice(0, 7) + '-31'; }
    var kw = d.kw.trim();
    var list = S.billsOf(d.dorm.id).filter(function (b) {
      if (b.occurredOn < from || b.occurredOn > to) return false;
      if (d.catId && b.categoryId !== d.catId) return false;
      if (kw) {
        var payer = (S.userById(b.payerId) || {}).name || '';
        var cat = (S.catById(b.categoryId) || {}).name || '';
        if ((b.title + b.note + payer + cat).indexOf(kw) < 0) return false;
      }
      return true;
    });
    if (d.sort === 'amount') list = list.slice().sort(function (a, b) { return b.amountCents - a.amountCents; });
    var sum = 0;
    var me = S.me();
    var rows = list.map(function (b) {
      sum += b.amountCents;
      var c = S.catById(b.categoryId);
      var mine = 0;
      b.splits.forEach(function (s) { if (s.memberId === me.id) mine += s.cents; });
      return {
        id: b.id, title: b.title, date: F.md(b.occurredOn), dow: F.dowCN(b.occurredOn),
        hue: c ? c.hue : '#5B6B7A', cat: c ? c.name : '其他',
        amount: F.yuan(b.amountCents), mine: F.yuan(mine),
        payer: (S.userById(b.payerId) || {}).name || '', settled: b.settled,
        modeCN: b.splitMode === 'equal' ? '均摊' : b.splitMode === 'ratio' ? '比例' : '自定义'
      };
    });
    var anchorCN = d.period === 'month' ? F.monthCN(d.anchor.slice(0, 7))
      : d.period === 'week' ? F.md(from) + ' — ' + F.md(to)
      : F.cnDate(d.anchor) + ' ' + F.dowCN(d.anchor);
    this.setData({ list: rows, sum: F.yuan(sum), n: rows.length, anchorCN: anchorCN });
  },
  setPeriod: function (e) { this.setData({ period: e.currentTarget.dataset.p }); this.refresh(); },
  setCat: function (e) { this.setData({ catId: e.currentTarget.dataset.id || '' }); this.refresh(); },
  onKw: function (e) { this.setData({ kw: e.detail.value }); this.refresh(); },
  clearKw: function () { this.setData({ kw: '' }); this.refresh(); },
  toggleSort: function () { this.setData({ sort: this.data.sort === 'time' ? 'amount' : 'time' }); this.refresh(); },
  onAnchor: function (e) { this.setData({ anchor: e.detail.value }); this.refresh(); },
  openBill: function (e) { wx.navigateTo({ url: '/pages/bill-detail/bill-detail?id=' + e.currentTarget.dataset.id }); },
  goAdd: function () { wx.navigateTo({ url: '/pages/bill-add/bill-add' }); }
});