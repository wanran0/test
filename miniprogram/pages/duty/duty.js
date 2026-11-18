var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    dorm: null, week: [], sel: null, selDateCN: '', selName: '', selHue: '', selState: '',
    selMine: false, selSwap: null, swapTargetName: '', canRespond: false,
    order: [], isHead: false, history: [], sheet: false, candidates: [], today: ''
  },
  onShow: function () {
    S.init();
    var tb = this.getTabBar && this.getTabBar();
    if (tb) tb.setData({ selected: 2 });
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    var dorm = S.myDorm();
    if (!this.data.today) this.setData({ today: F.today() });
    this.setData({ dorm: dorm, isHead: S.isHead() });
    if (dorm) this.refresh(this.data.sel ? this.data.sel.date : F.today());
  },
  refresh: function (selDate) {
    var dorm = this.data.dorm; if (!dorm) return;
    var from = F.weekStart(F.today());
    var list = S.dutyRange(dorm.id, from, F.addDays(from, 6));
    var today = F.today();
    var week = list.map(function (y) {
      var u = S.userById(y.memberId);
      var state = y.done ? 'done' : y.date < today ? 'miss' : y.date === today ? 'today' : 'future';
      return { id: y.id, date: y.date, md: F.md(y.date), dow: F.dowCN(y.date).slice(1), hue: u ? u.hue : '#999', initial: u ? u.name[0] : '?', state: state, sel: y.date === selDate };
    });
    var sel = null;
    list.forEach(function (y) { if (y.date === selDate) sel = y; });
    if (!sel) { sel = list.filter(function (y) { return y.date === today; })[0] || list[0]; selDate = sel.date; }
    var su = S.userById(sel.memberId);
    var state = sel.done ? 'done' : sel.date < today ? 'miss' : sel.date === today ? 'todo' : 'future';
    var me = S.me();
    var swap = sel.swap;
    var order = dorm.dutyOrder.map(function (id, i) {
      var u = S.userById(id);
      return { id: id, name: u ? u.name : '?', hue: u ? u.hue : '#999', i: i, first: i === 0, last: i === dorm.dutyOrder.length - 1 };
    });
    var history = S.dutyRange(dorm.id, F.addDays(today, -7), F.addDays(today, -1)).reverse().map(function (y) {
      var u = S.userById(y.memberId);
      return { id: y.id, date: F.md(y.date), name: u ? u.name : '?', hue: u ? u.hue : '#999', done: y.done, time: y.doneAt ? F.hhmm(y.doneAt) : '' };
    });
    this.setData({
      week: week, sel: sel, selDateCN: F.cnDate(sel.date) + ' ' + F.dowCN(sel.date),
      selName: su ? su.name : '?', selHue: su ? su.hue : '#999', selState: state,
      selMine: sel.memberId === me.id, selSwap: swap,
      swapTargetName: swap ? (S.userById(swap.to) || {}).name : '',
      canRespond: !!(swap && swap.status === 'pending' && swap.to === me.id),
      order: order, history: history
    });
  },
  pickDay: function (e) { this.refresh(e.currentTarget.dataset.date); },
  onCheckin: function () {
    if (!this.data.selMine) { wx.showToast({ title: '仅值日生本人可打卡', icon: 'none' }); return; }
    S.checkin(this.data.sel.id);
    wx.showToast({ title: this.data.sel.date < F.today() ? '补卡成功' : '打卡成功', icon: 'success' });
    this.refresh(this.data.sel.date);
  },
  openSwap: function () {
    var me = S.me();
    var cand = S.members(this.data.dorm.id).filter(function (m) { return m.id !== me.id; });
    this.setData({ sheet: true, candidates: cand });
  },
  closeSheet: function () { this.setData({ sheet: false }); },
  pickTarget: function (e) {
    S.requestSwap(this.data.sel.id, e.currentTarget.dataset.id);
    this.setData({ sheet: false });
    wx.showToast({ title: '换班申请已发出', icon: 'success' });
    this.refresh(this.data.sel.date);
  },
  onRespond: function (e) {
    var accept = e.currentTarget.dataset.ok === '1';
    S.respondSwap(this.data.sel.id, accept);
    wx.showToast({ title: accept ? '已同意换班' : '已拒绝', icon: accept ? 'success' : 'none' });
    this.refresh(this.data.sel.date);
  },
  move: function (e) {
    var ds = e.currentTarget.dataset;
    S.reorderDuty(this.data.dorm.id, ds.id, ds.dir === 'up' ? -1 : 1);
    this.refresh(this.data.sel.date);
  }
});