var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: { dorm: null, rows: [], transfers: [], history: [], isHead: false, isEmpty: false },
  onShow: function () {
    S.init();
    var me = S.me(); var dorm = S.myDorm();
    if (!dorm) { wx.showToast({ title: '请先加入寝室', icon: 'none' }); setTimeout(function () { wx.navigateBack(); }, 900); return; }
    this.refresh();
  },
  refresh: function () {
    var dorm = S.myDorm();
    var map = S.balances(dorm.id);
    var rows = S.members(dorm.id).map(function (m) {
      var v = map[m.id] || 0;
      return { id: m.id, name: m.name, hue: m.hue, str: F.yuan(Math.abs(v)), dir: v > 0 ? '应收' : v < 0 ? '应付' : '结清', cls: v > 0 ? 'jade' : v < 0 ? 'verm' : 'mut' };
    }).sort(function (a, b) { return a.dir === '应付' ? -1 : 1; });
    var tr = S.transfers(dorm.id).map(function (t) {
      return {
        from: (S.userById(t.from) || {}).name, to: (S.userById(t.to) || {}).name,
        fromHue: (S.userById(t.from) || {}).hue, toHue: (S.userById(t.to) || {}).hue,
        str: F.yuan(t.cents)
      };
    });
    var history = (S.settlementsOf(dorm.id) || []).map(function (st) {
      return {
        id: st.id, ago: F.timeAgo(st.createdAt), n: st.transfers.length,
        sum: F.yuan(st.transfers.reduce(function (s, t) { return s + t.cents; }, 0)),
        detail: st.transfers.map(function (t) { return (S.userById(t.from) || {}).name + '→' + (S.userById(t.to) || {}).name + ' ¥' + F.yuan(t.cents); }).join('；')
      };
    });
    this.setData({ dorm: dorm, rows: rows, transfers: tr, history: history, isHead: S.isHead(), isEmpty: tr.length === 0, roleCN: S.roleCN(S.me().role) });
  },
  onSettle: function () {
    var that = this;
    wx.showModal({
      title: '确认结清', content: '将按上方转账建议标记全部待结账单为已结清，并写入结算记录。',
      confirmColor: '#0F3D33',
      success: function (r) {
        if (!r.confirm) return;
        var res = S.settleAll(that.data.dorm.id);
        if (!res.ok) { wx.showToast({ title: res.msg, icon: 'none' }); return; }
        wx.showToast({ title: '已结清 ' + res.transfers.length + ' 笔转账', icon: 'success' });
        that.refresh();
      }
    });
  }
});