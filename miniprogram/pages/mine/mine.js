var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    me: null, dorm: null, roleCN: '', version: '', identities: [],
    entries: [], myBillN: 0, myDutyN: 0
  },
  onShow: function () {
    S.init();
    var tb = this.getTabBar && this.getTabBar();
    if (tb) tb.setData({ selected: 3 });
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    var dorm = S.myDorm();
    var app = getApp();
    var ids = ['u1', 'u2', 'u9'];
    var identities = ids.map(function (id) {
      var u = S.userById(id);
      return { id: id, name: u.name, hue: u.hue, roleCN: S.roleCN(u.role), cur: u.id === me.id, locked: !!u.locked };
    });
    var myBillN = 0, myDutyN = 0;
    if (dorm) {
      S.billsOf(dorm.id).forEach(function (b) {
        b.splits.forEach(function (s) { if (s.memberId === me.id) myBillN++; });
      });
      S.dutyRange(dorm.id, F.addDays(F.today(), -30), F.today()).forEach(function (y) {
        if (y.memberId === me.id && y.done) myDutyN++;
      });
    }
    var entries = [
      { k: 'dorm', t: '我的寝室', s: dorm ? dorm.name : '加入 / 创建', url: '/pages/dorm/dorm' },
      { k: 'feedback', t: '反馈与投诉', s: '建议 · 投诉 · 纠纷调解', url: '/pages/feedback/feedback' },
      { k: 'stats', t: '统计与匿名对比', s: '类别 / 成员 / 跨寝室', url: '/pages/stats/stats' },
      { k: 'report', t: 'AI 月报', s: '离线模板 · 接口占位', url: '/pages/report/report' }
    ];
    if (me.role === 'admin') entries.unshift({ k: 'admin', t: '管理后台', s: '用户 / 寝室 / 内容管理', url: '/pages/admin/admin' });
    this.setData({
      me: me, dorm: dorm, roleCN: S.roleCN(me.role), version: app.globalData.version,
      identities: identities, entries: entries, myBillN: myBillN, myDutyN: myDutyN
    });
  },
  switchId: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id === this.data.me.id) return;
    var r = S.login(id);
    if (!r.ok) { wx.showToast({ title: r.msg, icon: 'none' }); return; }
    var u = r.user;
    wx.showToast({ title: '已切换为 ' + u.name, icon: 'none' });
    setTimeout(function () {
      if (u.role === 'admin') wx.reLaunch({ url: '/pages/admin/admin' });
      else wx.reLaunch({ url: '/pages/index/index' });
    }, 500);
  },
  go: function (e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  resetData: function () {
    var that = this;
    wx.showModal({
      title: '重置演示数据', content: '恢复为初始种子账本（账单/排班/反馈），用于评审演示。', confirmColor: '#D9482B',
      success: function (r) {
        if (!r.confirm) return;
        S.reset();
        wx.showToast({ title: '已重置', icon: 'success' });
        that.onShow();
      }
    });
  },
  logout: function () {
    S.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});