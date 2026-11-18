var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: { b: null, cat: null, payer: null, rows: [], canDelete: false, modeCN: '', amount: '', gone: false },
  onLoad: function (q) { this.id = q.id; },
  onShow: function () {
    S.init();
    var b = null;
    S.allBills().forEach(function (x) { if (x.id === this.id) b = x; }, this);
    if (!b) { this.setData({ gone: true }); return; }
    var me = S.me();
    var dorm = S.dormById(b.dormId);
    var rows = b.splits.map(function (s) {
      var u = S.userById(s.memberId);
      return {
        id: s.memberId, name: u ? u.name : '?', hue: u ? u.hue : '#999',
        str: F.yuan(s.cents), pct: b.amountCents ? Math.round(s.cents * 100 / b.amountCents) : 0,
        isPayer: s.memberId === b.payerId
      };
    });
    this.setData({
      b: b, gone: false,
      cat: S.catById(b.categoryId), payer: S.userById(b.payerId),
      rows: rows, amount: F.yuan(b.amountCents),
      modeCN: b.splitMode === 'equal' ? '均摊' : b.splitMode === 'ratio' ? '按比例' : '自定义金额',
      canDelete: !!(me && (me.id === b.payerId || (dorm && dorm.headId === me.id) || me.role === 'admin')),
      dateCN: F.cnDate(b.occurredOn) + ' ' + F.dowCN(b.occurredOn),
      createdAgo: F.timeAgo(b.createdAt)
    });
  },
  onDelete: function () {
    var that = this;
    wx.showModal({
      title: '删除账单', content: '删除后可在 4 秒内撤销，确定删除「' + this.data.b.title + '」？',
      confirmColor: '#D9482B',
      success: function (r) {
        if (!r.confirm) return;
        var undo = S.deleteBill(that.id);
        that.setData({ gone: true });
        var snack = that.selectComponent('#snack');
        if (snack) snack.show('账单已删除', '撤销', function () { if (undo) undo(); that.onShow(); });
        setTimeout(function () { if (that.data.gone) wx.navigateBack(); }, 4300);
      }
    });
  }
});