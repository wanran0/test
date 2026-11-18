var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    me: null, dorm: null, roleCN: '', isHead: false, isAdmin: false,
    monthCN: '', total: '0.00', myShare: '0.00', count: 0, avg: '0.00', memberN: 0,
    balance: 0, balanceStr: '0.00', balanceDir: '',
    duty: null, dutyName: '', dutyState: '', dutyMine: false,
    recent: [], admin: null
  },
  onShow: function () {
    S.init();
    var tb = this.getTabBar && this.getTabBar();
    if (tb) tb.setData({ selected: 0 });
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    var dorm = S.myDorm();
    var month = F.monthKey(F.today());
    var base = {
      me: me, roleCN: S.roleCN(me.role), isHead: S.isHead(), isAdmin: S.isAdmin(),
      dorm: dorm, monthCN: F.monthCN(month)
    };
    if (S.isAdmin()) {
      base.admin = S.adminStats();
      base.admin.totalStr = F.yuan(base.admin.total);
      this.setData(base); return;
    }
    if (!dorm) { this.setData(base); return; }
    var st = S.stats(dorm.id, month);
    var myShare = 0;
    st.bills.forEach(function (b) {
      b.splits.forEach(function (s) { if (s.memberId === me.id) myShare += s.cents; });
    });
    var bal = S.balances(dorm.id)[me.id] || 0;
    var today = F.today();
    var duty = S.dutyRange(dorm.id, today, today)[0] || null;
    var dutyName = duty ? (S.userById(duty.memberId) || {}).name : '';
    var dutyState = !duty ? '' : duty.done ? 'done' : (duty.date < today ? 'miss' : 'todo');
    var recent = S.billsOf(dorm.id).slice(0, 5).map(function (b) {
      var c = S.catById(b.categoryId);
      var mine = 0;
      b.splits.forEach(function (s) { if (s.memberId === me.id) mine += s.cents; });
      return {
        id: b.id, title: b.title, date: F.md(b.occurredOn), hue: c ? c.hue : '#5B6B7A',
        cat: c ? c.name : '其他', amount: F.yuan(b.amountCents), mine: F.yuan(mine),
        payer: (S.userById(b.payerId) || {}).name || '', settled: b.settled
      };
    });
    this.setData(Object.assign(base, {
      total: F.yuan(st.total), myShare: F.yuan(myShare), count: st.count, avg: F.yuan(st.avg),
      memberN: dorm.memberIds.length,
      balance: bal, balanceStr: F.yuan(Math.abs(bal)),
      balanceDir: bal > 0 ? '应收' : bal < 0 ? '应付' : '已结清',
      duty: duty, dutyName: dutyName, dutyState: dutyState, dutyMine: duty && duty.memberId === me.id,
      recent: recent
    }));
  },
  goAdd: function () { wx.navigateTo({ url: '/pages/bill-add/bill-add' }); },
  goSettle: function () { wx.navigateTo({ url: '/pages/settle/settle' }); },
  goStats: function () { wx.navigateTo({ url: '/pages/stats/stats' }); },
  goReport: function () { wx.navigateTo({ url: '/pages/report/report' }); },
  goBills: function () { wx.switchTab({ url: '/pages/bills/bills' }); },
  goDuty: function () { wx.switchTab({ url: '/pages/duty/duty' }); },
  goDorm: function () { wx.navigateTo({ url: '/pages/dorm/dorm' }); },
  goAdmin: function () { wx.navigateTo({ url: '/pages/admin/admin' }); },
  openBill: function (e) { wx.navigateTo({ url: '/pages/bill-detail/bill-detail?id=' + e.currentTarget.dataset.id }); },
  onCheckin: function () {
    if (!this.data.duty) return;
    S.checkin(this.data.duty.id);
    wx.showToast({ title: '打卡成功', icon: 'success' });
    this.onShow();
  }
});