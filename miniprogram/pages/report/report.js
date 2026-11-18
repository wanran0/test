var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: { month: '', monthCN: '', text: '', busy: false },
  onLoad: function (q) {
    S.init();
    this.setData({ month: q.month || F.monthKey(F.today()) });
  },
  onShow: function () { this.gen(); },
  gen: function () {
    var that = this;
    this.setData({ busy: true, monthCN: F.monthCN(this.data.month) });
    setTimeout(function () {
      that.setData({ text: S.report(that.data.month), busy: false });
    }, 500);
  },
  onMonth: function (e) { this.setData({ month: e.detail.value.slice(0, 7) }); this.gen(); },
  copy: function () {
    wx.setClipboardData({
      data: this.data.text,
      success: function () { wx.showToast({ title: '已复制到剪贴板', icon: 'success' }); }
    });
  }
});